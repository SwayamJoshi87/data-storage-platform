import { defineBackend } from '@aws-amplify/backend';
import { Stack } from 'aws-cdk-lib';
import { Policy, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { auth } from './auth/resource';
import { storage, secondaryStorage } from './storage/resource';


/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
const backend = defineBackend({
  auth,
  storage,
  secondaryStorage
});

const adminRole = backend.auth.resources.groups.admin.role;
const authenticatedRole = backend.auth.resources.authenticatedUserIamRole;
const storageBucket = backend.storage.resources.bucket;
const ownerPrivatePrefixes = [
  'private/${cognito-identity.amazonaws.com:sub}/',
  'thumbnails/private/${cognito-identity.amazonaws.com:sub}/',
];

// Admin users assume the admin group role, so grant that role owner-scoped private access too.
new Policy(Stack.of(storageBucket), 'AdminOwnerPrivateAccessPolicy', {
  roles: [adminRole],
  statements: [
    new PolicyStatement({
      actions: ['s3:ListBucket'],
      resources: [storageBucket.bucketArn],
      conditions: {
        StringLike: {
          's3:prefix': ownerPrivatePrefixes.flatMap((prefix) => [prefix, `${prefix}*`]),
        },
      },
    }),
    new PolicyStatement({
      actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
      resources: ownerPrivatePrefixes.map((prefix) => storageBucket.arnForObjects(`${prefix}*`)),
    }),
  ],
});

// Amplify's generated storage policy should cover entity-owned thumbnails, but keep
// this explicit so authenticated users can always read/write their own sidecars.
new Policy(Stack.of(storageBucket), 'AuthenticatedOwnerPrivateAccessPolicy', {
  roles: [authenticatedRole],
  statements: [
    new PolicyStatement({
      actions: ['s3:ListBucket'],
      resources: [storageBucket.bucketArn],
      conditions: {
        StringLike: {
          's3:prefix': ownerPrivatePrefixes.flatMap((prefix) => [prefix, `${prefix}*`]),
        },
      },
    }),
    new PolicyStatement({
      actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
      resources: ownerPrivatePrefixes.map((prefix) => storageBucket.arnForObjects(`${prefix}*`)),
    }),
  ],
});
