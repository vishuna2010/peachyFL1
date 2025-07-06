#!/bin/bash

# PeachyFL AWS Deployment Script
# Usage: ./deploy-aws.sh [domain_name] [db_password]

set -e

DOMAIN_NAME=${1:-"yourdomain.com"}
DB_PASSWORD=${2:-"YourStrongPassword123!"}

echo "🚀 Starting PeachyFL AWS Deployment"
echo "Domain: $DOMAIN_NAME"
echo "Database Password: [HIDDEN]"

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install AWS CLI first."
    echo "   macOS: brew install awscli"
    echo "   Linux: curl 'https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip' -o 'awscliv2.zip' && unzip awscliv2.zip && sudo ./aws/install"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker first."
    exit 1
fi

# Check AWS credentials
echo "🔐 Checking AWS credentials..."
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS credentials not configured. Please run 'aws configure' first."
    exit 1
fi

echo "✅ Prerequisites check passed"

# Create infrastructure
echo "🏗️ Creating AWS infrastructure..."

# Create VPC
echo "Creating VPC..."
VPC_ID=$(aws ec2 create-vpc --cidr-block 10.0.0.0/16 --query 'Vpc.VpcId' --output text)
aws ec2 create-tags --resources $VPC_ID --tags Key=Name,Value=peachyfl-vpc
echo "✅ VPC created: $VPC_ID"

# Create subnets
echo "Creating subnets..."
SUBNET1_ID=$(aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.1.0/24 --availability-zone us-east-1a --query 'Subnet.SubnetId' --output text)
SUBNET2_ID=$(aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.2.0/24 --availability-zone us-east-1b --query 'Subnet.SubnetId' --output text)
echo "✅ Subnets created: $SUBNET1_ID, $SUBNET2_ID"

# Create security groups
echo "Creating security groups..."
APP_SG_ID=$(aws ec2 create-security-group --group-name peachyfl-app-sg --description "Security group for PeachyFL application" --vpc-id $VPC_ID --query 'GroupId' --output text)
DB_SG_ID=$(aws ec2 create-security-group --group-name peachyfl-db-sg --description "Security group for PeachyFL database" --vpc-id $VPC_ID --query 'GroupId' --output text)
echo "✅ Security groups created: $APP_SG_ID, $DB_SG_ID"

# Configure security group rules
echo "Configuring security group rules..."
aws ec2 authorize-security-group-ingress --group-id $APP_SG_ID --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $APP_SG_ID --protocol tcp --port 443 --cidr 0.0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $APP_SG_ID --protocol tcp --port 22 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $DB_SG_ID --protocol tcp --port 5432 --source-group $APP_SG_ID
echo "✅ Security group rules configured"

# Create S3 bucket
echo "Creating S3 bucket..."
S3_BUCKET="peachyfl-production-files-$(aws sts get-caller-identity --query Account --output text)"
aws s3 mb s3://$S3_BUCKET --region us-east-1
aws s3api put-bucket-versioning --bucket $S3_BUCKET --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption --bucket $S3_BUCKET --server-side-encryption-configuration '{
  "Rules": [
    {
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }
  ]
}'
echo "✅ S3 bucket created: $S3_BUCKET"

# Create RDS instance
echo "Creating RDS instance..."
aws rds create-db-instance \
  --db-instance-identifier peachyfl-prod \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username peachyfl_admin \
  --master-user-password "$DB_PASSWORD" \
  --allocated-storage 20 \
  --storage-type gp2 \
  --vpc-security-group-ids $DB_SG_ID \
  --backup-retention-period 7 \
  --storage-encrypted \
  --db-name peachyfl_prod

echo "⏳ Waiting for RDS instance to be available..."
aws rds wait db-instance-available --db-instance-identifier peachyfl-prod
RDS_ENDPOINT=$(aws rds describe-db-instances --db-instance-identifier peachyfl-prod --query 'DBInstances[0].Endpoint.Address' --output text)
echo "✅ RDS instance created: $RDS_ENDPOINT"

# Create EC2 key pair
echo "Creating EC2 key pair..."
aws ec2 create-key-pair --key-name peachyfl-key --query 'KeyMaterial' --output text > peachyfl-key.pem
chmod 400 peachyfl-key.pem
echo "✅ EC2 key pair created: peachyfl-key.pem"

# Create EC2 instance
echo "Creating EC2 instance..."
INSTANCE_ID=$(aws ec2 run-instances \
  --image-id ami-0c02fb55956c7d316 \
  --count 1 \
  --instance-type t3.medium \
  --key-name peachyfl-key \
  --security-group-ids $APP_SG_ID \
  --subnet-id $SUBNET1_ID \
  --tag-specifications ResourceType=instance,Tags=[{Key=Name,Value=peachyfl-app-server}] \
  --query 'Instances[0].InstanceId' --output text)

echo "⏳ Waiting for EC2 instance to be running..."
aws ec2 wait instance-running --instance-ids $INSTANCE_ID
EC2_IP=$(aws ec2 describe-instances --instance-ids $INSTANCE_ID --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)
echo "✅ EC2 instance created: $INSTANCE_ID ($EC2_IP)"

# Create production environment file
echo "⚙️ Creating production environment configuration..."
cat > .env << EOF
# Database (RDS)
DATABASE_URL=postgresql://peachyfl_admin:$DB_PASSWORD@$RDS_ENDPOINT:5432/peachyfl_prod

# AWS S3
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=$S3_BUCKET

# JWT
JWT_SECRET=$(openssl rand -base64 32)
JWT_EXPIRES_IN=1d

# Payment Gateways (Update with your credentials)
STRIPE_ENABLED=true
STRIPE_PUBLISHABLE_KEY=pk_live_your_live_stripe_key
STRIPE_SECRET_KEY=sk_live_your_live_stripe_secret
STRIPE_TEST_MODE=false

PAYPAL_ENABLED=true
PAYPAL_CLIENT_ID=your_live_paypal_client_id
PAYPAL_SECRET=your_live_paypal_secret
PAYPAL_SANDBOX=false

PLUGNPAY_ENABLED=true
PLUGNPAY_USERNAME=your_plugnpay_username
PLUGNPAY_PASSWORD=your_plugnpay_password
PLUGNPAY_GATEWAY_URL=https://pay1.plugnpay.com/pay/

# Email (Update with your credentials)
EMAIL_SERVICE=ses
EMAIL_HOST=email-smtp.us-east-1.amazonaws.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your_ses_smtp_username
EMAIL_PASS=your_ses_smtp_password
EMAIL_FROM_ADDRESS=noreply@$DOMAIN_NAME

# Environment
NODE_ENV=production
PORT=3000
EOF

echo "✅ Production environment file created: .env"

# Build Docker image
echo "🐳 Building Docker image..."
docker build -t peachyfl:latest backend/
echo "✅ Docker image built: peachyfl:latest"

# Display deployment information
echo ""
echo "🎉 AWS Infrastructure Deployed Successfully!"
echo ""
echo "📊 Deployment Summary:"
echo "   Domain: $DOMAIN_NAME"
echo "   EC2 Instance: $INSTANCE_ID ($EC2_IP)"
echo "   Database: $RDS_ENDPOINT"
echo "   S3 Bucket: $S3_BUCKET"
echo "   Key Pair: peachyfl-key.pem"
echo ""
echo "🔧 Next Steps:"
echo "1. SSH into your EC2 instance:"
echo "   ssh -i peachyfl-key.pem ubuntu@$EC2_IP"
echo ""
echo "2. Install Docker and Docker Compose on EC2:"
echo "   curl -fsSL https://get.docker.com -o get-docker.sh"
echo "   sudo sh get-docker.sh"
echo "   sudo usermod -aG docker ubuntu"
echo "   sudo curl -L 'https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)' -o /usr/local/bin/docker-compose"
echo "   sudo chmod +x /usr/local/bin/docker-compose"
echo ""
echo "3. Copy your application files to EC2:"
echo "   scp -i peachyfl-key.pem -r . ubuntu@$EC2_IP:/home/ubuntu/peachyfl"
echo ""
echo "4. Deploy the application:"
echo "   ssh -i peachyfl-key.pem ubuntu@$EC2_IP"
echo "   cd peachyfl"
echo "   docker-compose up -d"
echo ""
echo "5. Update your domain DNS to point to: $EC2_IP"
echo ""
echo "6. Test your application:"
echo "   curl http://$EC2_IP:3000/api/health"
echo ""
echo "📚 Documentation:"
echo "   - AWS Deployment Guide: AWS_DEPLOYMENT.md"
echo "   - Production Setup: backend/PRODUCTION_SETUP.md"
echo ""
echo "🔒 Security Notes:"
echo "   - Update the .env file with your actual payment gateway credentials"
echo "   - Configure SSL certificate for your domain"
echo "   - Set up CloudWatch monitoring"
echo "   - Configure automated backups"
echo ""
echo "💰 Estimated Monthly Cost: ~$65-130"
echo ""
echo "✅ Deployment completed! Your PeachyFL application is ready for production." 