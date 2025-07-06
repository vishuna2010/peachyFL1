terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  backend "s3" {
    bucket = "peachyfl-terraform-state"
    key    = "production/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "PeachyFL"
      Environment = "production"
      ManagedBy   = "terraform"
    }
  }
}

# VPC and Networking
module "vpc" {
  source = "./modules/vpc"
  
  vpc_cidr             = var.vpc_cidr
  environment          = var.environment
  availability_zones   = var.availability_zones
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
}

# Security Groups
module "security_groups" {
  source = "./modules/security_groups"
  
  vpc_id     = module.vpc.vpc_id
  environment = var.environment
}

# RDS Database
module "rds" {
  source = "./modules/rds"
  
  environment          = var.environment
  vpc_id              = module.vpc.vpc_id
  private_subnet_ids  = module.vpc.private_subnet_ids
  security_group_ids  = [module.security_groups.database_sg_id]
  db_name             = var.db_name
  db_username         = var.db_username
  db_password         = var.db_password
  db_instance_class   = var.db_instance_class
  allocated_storage   = var.db_allocated_storage
}

# ElastiCache Redis
module "elasticache" {
  source = "./modules/elasticache"
  
  environment         = var.environment
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  security_group_ids = [module.security_groups.cache_sg_id]
  node_type          = var.redis_node_type
  num_cache_nodes    = var.redis_num_cache_nodes
}

# S3 Bucket for file storage
module "s3" {
  source = "./modules/s3"
  
  environment = var.environment
  bucket_name = var.s3_bucket_name
}

# Application Load Balancer
module "alb" {
  source = "./modules/alb"
  
  environment        = var.environment
  vpc_id            = module.vpc.vpc_id
  public_subnet_ids = module.vpc.public_subnet_ids
  security_group_ids = [module.security_groups.alb_sg_id]
  certificate_arn   = module.acm.certificate_arn
}

# Auto Scaling Group
module "asg" {
  source = "./modules/asg"
  
  environment        = var.environment
  vpc_id            = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  security_group_ids = [module.security_groups.app_sg_id]
  target_group_arns  = [module.alb.target_group_arn]
  instance_type     = var.app_instance_type
  min_size          = var.app_min_size
  max_size          = var.app_max_size
  desired_capacity  = var.app_desired_capacity
}

# SSL Certificate
module "acm" {
  source = "./modules/acm"
  
  domain_name = var.domain_name
  environment = var.environment
}

# CloudWatch Log Groups
module "cloudwatch" {
  source = "./modules/cloudwatch"
  
  environment = var.environment
}

# IAM Roles and Policies
module "iam" {
  source = "./modules/iam"
  
  environment = var.environment
  s3_bucket_arn = module.s3.bucket_arn
}

# Route 53 DNS
module "route53" {
  source = "./modules/route53"
  
  domain_name = var.domain_name
  alb_dns_name = module.alb.dns_name
  alb_zone_id  = module.alb.zone_id
}

# CloudFront CDN (Optional)
module "cloudfront" {
  source = "./modules/cloudfront"
  
  count = var.enable_cloudfront ? 1 : 0
  
  domain_name = var.domain_name
  alb_domain_name = module.alb.dns_name
  certificate_arn = module.acm.certificate_arn
} 