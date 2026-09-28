import { RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';

interface DataStackProps extends StackProps {
  stage: string;
}

export class DataStack extends Stack {
  readonly recordsTable: Table;
  readonly configTable: Table;
  readonly configBucket: Bucket;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);
    this.recordsTable = new Table(this, 'RecordsTable', {
      tableName: `tls-${props.stage}-records`,
      partitionKey: { name: 'recordId', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expiresAt',
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: false },
      deletionProtection: props.stage === 'prod',
      removalPolicy: RemovalPolicy.RETAIN,
    });
    this.configTable = new Table(this, 'ConfigTable', {
      tableName: `tls-${props.stage}-config`,
      partitionKey: { name: 'configKey', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: false },
      deletionProtection: props.stage === 'prod',
      removalPolicy: RemovalPolicy.RETAIN,
    });
    this.configBucket = new Bucket(this, 'ConfigBucket', {
      bucketName: `tls-${props.stage}-${this.account}-${this.region}-config`,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });
  }
}
