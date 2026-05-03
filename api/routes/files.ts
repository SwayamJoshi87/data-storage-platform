import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '../db/client';
import { files, vaults } from '../db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import type { AuthVariables } from '../middleware/auth';

const app = new Hono<{ Variables: AuthVariables }>();

const uploadUrlSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().default('application/octet-stream'),
  sizeBytes: z.number().positive(),
  storageTier: z.enum(['hot', 'warm', 'cold', 'frozen']).default('frozen'),
  path: z.string().default('/'),
});

// GET /vaults/:vaultId/files
app.get('/:vaultId/files', async (c) => {
  const userId = c.get('userId');
  const vaultId = c.req.param('vaultId');

  // Verify vault ownership
  const [vault] = await db
    .select()
    .from(vaults)
    .where(and(eq(vaults.id, vaultId), eq(vaults.userId, userId), isNull(vaults.deletedAt)));
  if (!vault) return c.json({ error: 'Not found' }, 404);

  const rows = await db
    .select()
    .from(files)
    .where(and(eq(files.vaultId, vaultId), isNull(files.deletedAt)));

  return c.json(rows);
});

// POST /vaults/:vaultId/upload-url  — returns presigned S3 upload URL
// TODO Step 5: implement real presigned URL generation via StorageBackend
app.post('/:vaultId/upload-url', zValidator('json', uploadUrlSchema), async (c) => {
  const userId = c.get('userId');
  const vaultId = c.req.param('vaultId');
  const body = c.req.valid('json');

  const [vault] = await db
    .select()
    .from(vaults)
    .where(and(eq(vaults.id, vaultId), eq(vaults.userId, userId), isNull(vaults.deletedAt)));
  if (!vault) return c.json({ error: 'Not found' }, 404);

  const fileId = crypto.randomUUID();
  const s3Key = `tenants/${userId}/vaults/${vaultId}/${fileId}`;

  // TODO Step 5: StorageBackend.generatePresignedUploadUrl(s3Key, body)
  return c.json({
    fileId,
    s3Key,
    uploadUrl: null, // populated in Step 5
    fields: {},
  });
});

// DELETE /vaults/:vaultId/files/:fileId  (soft delete)
// TODO Step 5: also issue S3 delete via StorageBackend
app.delete('/:vaultId/files/:fileId', async (c) => {
  const userId = c.get('userId');
  const vaultId = c.req.param('vaultId');
  const fileId = c.req.param('fileId');

  const [file] = await db
    .update(files)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(files.id, fileId),
        eq(files.vaultId, vaultId),
        eq(files.userId, userId),
        isNull(files.deletedAt),
      ),
    )
    .returning();

  if (!file) return c.json({ error: 'Not found' }, 404);
  return c.json({ ok: true });
});

export default app;
