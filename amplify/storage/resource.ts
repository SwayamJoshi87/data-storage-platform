import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'myStorageBucket',
  isDefault: true,
  access: (allow) => ({
    'public/*': [
      allow.guest.to(['read']),
      allow.authenticated.to(['read']),
      allow.groups(['admin']).to(['read', 'write', 'delete']),
    ],
    'admin/*': [
      // Only admin group can read/write/delete under admin/
      allow.groups(['admin']).to(['read', 'write', 'delete']),
    ],
    // Use the standard identity placeholder so Amplify generates correct policies
    // Admins still need access to their own My Files because admin users are mapped
    // to the admin role instead of the default authenticated role.
    'private/{identityId}/*': [
      allow.entity('identity').to(['read', 'write', 'delete']),
      allow.groups(['admin']).to(['read', 'write', 'delete']),
    ],
  }),
});

export const secondaryStorage = defineStorage({
  name: 'mySecondaryStorageBucket',
  access: (allow) => ({
    'backup_public/*': [allow.guest.to(['read']), allow.authenticated.to(['read'])],
    'backup_admin/*': [allow.groups(['admin']).to(['read', 'write', 'delete'])],
    'backup_private/{identityId}/*': [
      allow.entity('identity').to(['read', 'write', 'delete']),
      allow.groups(['admin']).to(['read', 'write', 'delete']),
    ],
  }),
});
