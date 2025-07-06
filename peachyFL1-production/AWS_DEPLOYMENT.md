# 🚀 AWS Deployment Guide for PeachyFL

## 📋 Prerequisites

### AWS Account Setup
- [ ] AWS Account with billing enabled
- [ ] AWS CLI installed and configured
- [ ] AWS IAM user with appropriate permissions
- [ ] Domain name registered (Route 53 or external)

### Required AWS Services
- **EC2** - Application server
- **RDS** - PostgreSQL database
- **ElastiCache** - Redis for caching
- **S3** - File storage
- **CloudFront** - CDN (optional)
- **Route 53** - DNS management
- **ACM** - SSL certificates
- **IAM** - Security and permissions
- **CloudWatch** - Monitoring and logging

## 🏗️ Infrastructure Architecture

```
Internet → CloudFront → ALB → EC2 (Auto Scaling) → RDS
                    ↓
                Route 53
                    ↓
                ACM (SSL)
```

## 📦 Step-by-Step Deployment

### 1. **Quick Start with AWS CLI**

#### Install AWS CLI
```bash
# macOS
brew install awscli

# Linux
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

#### Configure AWS CLI
```bash
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Enter your default region (e.g., us-east-1)
# Enter your output format (json)
```

### 2. **Create AWS Infrastructure**

#### Create VPC and Networking
```bash
# Create VPC
VPC_ID=$(aws ec2 create-vpc --cidr-block 10.0.0.0/16 --query 'Vpc.VpcId' --output text)
aws ec2 create-tags --resources $VPC_ID --tags Key=Name,Value=peachyfl-vpc

# Create subnets
SUBNET1_ID=$(aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.1.0/24 --availability-zone us-east-1a --query 'Subnet.SubnetId' --output text)
SUBNET2_ID=$(aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.2.0/24 --availability-zone us-east-1b --query 'Subnet.SubnetId' --output text)
```

#### Create Security Groups
```bash
# Application Security Group
APP_SG_ID=$(aws ec2 create-security-group --group-name peachyfl-app-sg --description "Security group for PeachyFL application" --vpc-id $VPC_ID --query 'GroupId' --output text)

# Database Security Group
DB_SG_ID=$(aws ec2 create-security-group --group-name peachyfl-db-sg --description "Security group for PeachyFL database" --vpc-id $VPC_ID --query 'GroupId' --output text)
```

### 3. **Database Setup (RDS)**

#### Create RDS Instance
```bash
aws rds create-db-instance \
  --db-instance-identifier peachyfl-prod \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username peachyfl_admin \
  --master-user-password "YourStrongPassword123!" \
  --allocated-storage 20 \
  --storage-type gp2 \
  --vpc-security-group-ids $DB_SG_ID \
  --backup-retention-period 7 \
  --storage-encrypted
```

### 4. **S3 Setup for File Storage**

#### Create S3 Bucket
```bash
aws s3 mb s3://peachyfl-production-files
aws s3api put-bucket-versioning --bucket peachyfl-production-files --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption --bucket peachyfl-production-files --server-side-encryption-configuration '{
  "Rules": [
    {
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }
  ]
}'
```

### 5. **SSL Certificate (ACM)**

#### Request SSL Certificate
```bash
aws acm request-certificate \
  --domain-name yourdomain.com \
  --subject-alternative-names *.yourdomain.com \
  --validation-method DNS
```

## 🐳 Docker Deployment on AWS

### 1. **EC2 Instance Setup**

#### Create EC2 Instance
```bash
# Create key pair
aws ec2 create-key-pair --key-name peachyfl-key --query 'KeyMaterial' --output text > peachyfl-key.pem
chmod 400 peachyfl-key.pem

# Create EC2 instance
aws ec2 run-instances \
  --image-id ami-0c02fb55956c7d316 \
  --count 1 \
  --instance-type t3.medium \
  --key-name peachyfl-key \
  --security-group-ids $APP_SG_ID \
  --subnet-id $SUBNET1_ID \
  --tag-specifications ResourceType=instance,Tags=[{Key=Name,Value=peachyfl-app-server}]
```

#### Connect to EC2 Instance
```bash
ssh -i peachyfl-key.pem ubuntu@your-ec2-ip
```

#### Install Docker and Docker Compose
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Logout and login again
exit
ssh -i peachyfl-key.pem ubuntu@your-ec2-ip
```

### 2. **Deploy Application**

#### Clone Repository
```bash
git clone https://github.com/yourusername/peachyFL1.git
cd peachyFL1
```

#### Configure Environment
```bash
# Create production environment file
cp backend/env.template .env

# Edit .env with AWS-specific values
nano .env
```

#### Production .env Configuration
```bash
# Database (RDS)
DATABASE_URL=postgresql://peachyfl_admin:YourStrongPassword123!@your-rds-endpoint:5432/peachyfl_prod

# AWS S3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET_NAME=peachyfl-production-files

# JWT
JWT_SECRET=your-super-strong-jwt-secret-at-least-32-characters-long
JWT_EXPIRES_IN=1d

# Payment Gateways
STRIPE_ENABLED=true
STRIPE_PUBLISHABLE_KEY=pk_live_your_live_stripe_key
STRIPE_SECRET_KEY=sk_live_your_live_stripe_secret
STRIPE_TEST_MODE=false

PAYPAL_ENABLED=true
PAYPAL_CLIENT_ID=your_live_paypal_client_id
PAYPAL_SECRET=your_live_paypal_secret
PAYPAL_SANDBOX=false

# Email (SES or other service)
EMAIL_SERVICE=ses
EMAIL_HOST=email-smtp.us-east-1.amazonaws.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your_ses_smtp_username
EMAIL_PASS=your_ses_smtp_password
EMAIL_FROM_ADDRESS=noreply@yourdomain.com

# Environment
NODE_ENV=production
PORT=3000
```

#### Deploy with Docker Compose
```bash
# Build and start services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

## 🔒 Security Configuration

### 1. **Security Groups Configuration**

#### Application Security Group Rules
```bash
# Allow HTTP
aws ec2 authorize-security-group-ingress \
  --group-id $APP_SG_ID \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0

# Allow HTTPS
aws ec2 authorize-security-group-ingress \
  --group-id $APP_SG_ID \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0

# Allow SSH (restrict to your IP)
aws ec2 authorize-security-group-ingress \
  --group-id $APP_SG_ID \
  --protocol tcp \
  --port 22 \
  --cidr your-ip/32
```

### 2. **IAM Roles and Policies**

#### Create IAM Role for EC2
```bash
# Create role
aws iam create-role --role-name PeachyFLEC2Role --assume-role-policy-document '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ec2.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}'

# Attach policies
aws iam attach-role-policy --role-name PeachyFLEC2Role --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadWriteAccess
aws iam attach-role-policy --role-name PeachyFLEC2Role --policy-arn arn:aws:iam::aws:policy/CloudWatchLogsFullAccess
```

## 📊 Monitoring and Logging

### 1. **CloudWatch Setup**

#### Create Log Groups
```bash
aws logs create-log-group --log-group-name /peachyfl/application
aws logs create-log-group --log-group-name /peachyfl/nginx
aws logs create-log-group --log-group-name /peachyfl/database
```

#### Configure CloudWatch Agent
```bash
# Install CloudWatch agent
sudo yum install -y amazon-cloudwatch-agent

# Configure agent
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-config-wizard
```

### 2. **Set Up Alarms**

#### Create CloudWatch Alarms
```bash
# CPU Utilization Alarm
aws cloudwatch put-metric-alarm \
  --alarm-name PeachyFL-CPU-High \
  --alarm-description "CPU utilization is high" \
  --metric-name CPUUtilization \
  --namespace AWS/EC2 \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:us-east-1:123456789012:PeachyFL-Alerts
```

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] AWS account configured with billing
- [ ] Domain name registered and configured
- [ ] SSL certificate requested and validated
- [ ] All environment variables configured
- [ ] Database credentials secured
- [ ] Payment gateway credentials configured

### Infrastructure
- [ ] VPC and subnets created
- [ ] Security groups configured
- [ ] RDS instance created and accessible
- [ ] S3 bucket created with proper permissions
- [ ] EC2 instance launched and configured
- [ ] Load balancer configured
- [ ] Auto scaling group created

### Application
- [ ] Application deployed and running
- [ ] Health checks passing
- [ ] Database migrations completed
- [ ] SSL certificate installed
- [ ] Domain pointing to load balancer
- [ ] Monitoring and alerting configured

### Testing
- [ ] All payment methods tested
- [ ] API endpoints responding
- [ ] Admin panel accessible
- [ ] User registration/login working
- [ ] File uploads working
- [ ] Email notifications working

## 🔧 Maintenance Commands

### Application Management
```bash
# Update application
git pull origin main
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# View logs
docker-compose logs -f

# Backup database
docker-compose exec backend npm run backup

# Monitor resources
docker stats
```

### AWS Management
```bash
# Check RDS status
aws rds describe-db-instances --db-instance-identifier peachyfl-prod

# Monitor CloudWatch metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/EC2 \
  --metric-name CPUUtilization \
  --dimensions Name=InstanceId,Value=i-xxxxx \
  --start-time 2023-01-01T00:00:00Z \
  --end-time 2023-01-01T23:59:59Z \
  --period 3600 \
  --statistics Average

# Check S3 bucket
aws s3 ls s3://peachyfl-production-files
```

## 🆘 Troubleshooting

### Common Issues
1. **Database Connection**: Check security groups and RDS endpoint
2. **SSL Certificate**: Verify domain validation in ACM
3. **Application Not Starting**: Check Docker logs and environment variables
4. **Payment Failures**: Verify gateway credentials and webhook URLs
5. **Performance Issues**: Monitor CloudWatch metrics and scale accordingly

### Support Resources
- AWS Documentation: https://docs.aws.amazon.com/
- AWS Support: https://aws.amazon.com/support/
- PeachyFL Documentation: [Your Documentation URL]

## 💰 Cost Estimation

### Monthly Costs (US East 1)
- **RDS (db.t3.micro)**: ~$15-30/month
- **EC2 (t3.medium)**: ~$30-60/month
- **S3 (100GB)**: ~$5-10/month
- **Data Transfer**: ~$10-20/month
- **CloudWatch**: ~$5-10/month
- **Total**: ~$65-130/month

### Cost Optimization Tips
1. Use Reserved Instances for predictable workloads
2. Enable S3 lifecycle policies for cost optimization
3. Monitor and right-size instances
4. Use Spot Instances for non-critical workloads
5. Enable CloudWatch cost monitoring

---

**Remember**: Always test in a staging environment before deploying to production! 