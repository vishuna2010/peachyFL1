# VPC Outputs
output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = module.vpc.public_subnet_ids
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = module.vpc.private_subnet_ids
}

# Database Outputs
output "rds_endpoint" {
  description = "RDS endpoint"
  value       = module.rds.endpoint
}

output "rds_port" {
  description = "RDS port"
  value       = module.rds.port
}

output "database_name" {
  description = "Database name"
  value       = module.rds.database_name
}

# Redis Outputs
output "redis_endpoint" {
  description = "ElastiCache Redis endpoint"
  value       = module.elasticache.endpoint
}

output "redis_port" {
  description = "ElastiCache Redis port"
  value       = module.elasticache.port
}

# S3 Outputs
output "s3_bucket_name" {
  description = "S3 bucket name"
  value       = module.s3.bucket_name
}

output "s3_bucket_arn" {
  description = "S3 bucket ARN"
  value       = module.s3.bucket_arn
}

# Load Balancer Outputs
output "alb_dns_name" {
  description = "Application Load Balancer DNS name"
  value       = module.alb.dns_name
}

output "alb_zone_id" {
  description = "Application Load Balancer zone ID"
  value       = module.alb.zone_id
}

output "target_group_arn" {
  description = "Target group ARN"
  value       = module.alb.target_group_arn
}

# Auto Scaling Group Outputs
output "asg_name" {
  description = "Auto Scaling Group name"
  value       = module.asg.name
}

output "asg_arn" {
  description = "Auto Scaling Group ARN"
  value       = module.asg.arn
}

# SSL Certificate Outputs
output "certificate_arn" {
  description = "SSL certificate ARN"
  value       = module.acm.certificate_arn
}

output "certificate_status" {
  description = "SSL certificate status"
  value       = module.acm.status
}

# Route 53 Outputs
output "domain_name" {
  description = "Domain name"
  value       = var.domain_name
}

output "name_servers" {
  description = "Name servers for domain"
  value       = module.route53.name_servers
}

# CloudFront Outputs (if enabled)
output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = var.enable_cloudfront ? module.cloudfront[0].distribution_id : null
}

output "cloudfront_domain_name" {
  description = "CloudFront domain name"
  value       = var.enable_cloudfront ? module.cloudfront[0].domain_name : null
}

# IAM Outputs
output "ec2_role_arn" {
  description = "EC2 IAM role ARN"
  value       = module.iam.ec2_role_arn
}

output "ec2_instance_profile_arn" {
  description = "EC2 instance profile ARN"
  value       = module.iam.ec2_instance_profile_arn
}

# CloudWatch Outputs
output "log_group_names" {
  description = "CloudWatch log group names"
  value       = module.cloudwatch.log_group_names
}

# Connection Information
output "database_url" {
  description = "Database connection URL (without password)"
  value       = "postgresql://${var.db_username}:[PASSWORD]@${module.rds.endpoint}:${module.rds.port}/${var.db_name}"
  sensitive   = true
}

output "redis_url" {
  description = "Redis connection URL"
  value       = "redis://${module.elasticache.endpoint}:${module.elasticache.port}"
}

output "application_url" {
  description = "Application URL"
  value       = "https://${var.domain_name}"
}

# Deployment Instructions
output "deployment_instructions" {
  description = "Instructions for deploying the application"
  value = <<-EOT
    ========================================
    PeachyFL AWS Infrastructure Deployed!
    ========================================
    
    Next Steps:
    1. Update your .env file with these values:
       DATABASE_URL=postgresql://${var.db_username}:[PASSWORD]@${module.rds.endpoint}:${module.rds.port}/${var.db_name}
       REDIS_URL=${module.elasticache.endpoint}:${module.elasticache.port}
       AWS_S3_BUCKET_NAME=${module.s3.bucket_name}
    
    2. Deploy your application to the Auto Scaling Group
    3. Configure your domain DNS to point to: ${module.alb.dns_name}
    4. Wait for SSL certificate validation: ${module.acm.status}
    
    Application URL: https://${var.domain_name}
    Load Balancer: ${module.alb.dns_name}
    
    ========================================
  EOT
} 