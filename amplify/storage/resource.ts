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
    // Private files belong only to the owning identity.
    'private/{entity_id}/*': [allow.entity('identity').to(['read', 'write', 'delete'])],
    'thumbnails/public/*': [
      allow.guest.to(['read']),
      allow.authenticated.to(['read']),
      allow.groups(['admin']).to(['read', 'write', 'delete']),
    ],
    'thumbnails/admin/*': [allow.groups(['admin']).to(['read', 'write', 'delete'])],
    'thumbnails/private/{entity_id}/*': [
      allow.entity('identity').to(['read', 'write', 'delete']),
    ],
  }),
});

export const secondaryStorage = defineStorage({
  name: 'mySecondaryStorageBucket',
  access: (allow) => ({
    'backup_public/*': [allow.guest.to(['read']), allow.authenticated.to(['read'])],
    'backup_admin/*': [allow.groups(['admin']).to(['read', 'write', 'delete'])],
    'backup_private/{entity_id}/*': [allow.entity('identity').to(['read', 'write', 'delete'])],
  }),
});
