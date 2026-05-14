import type { Prisma, PrismaClient } from '@constancia/db';
import { discordUserIdToAuthEmail } from './identity.js';

export interface MergeDiscordShadowUserInput {
  prisma: PrismaClient;
  shadowUserId: string;
  logtoUserId: string;
  discordUserId: string;
}

export type MergeDiscordShadowUserResult =
  | { status: 'noop' }
  | { status: 'merged'; shadowUserId: string; logtoUserId: string; discordUserId: string }
  | { status: 'not-shadow'; shadowUserId: string; discordUserId: string };

async function reassignUserOwnedRecords(
  tx: Prisma.TransactionClient,
  shadowUserId: string,
  logtoUserId: string,
): Promise<void> {
  await tx.uploadAsset.updateMany({
    where: { userId: shadowUserId },
    data: { userId: logtoUserId },
  });

  await tx.messageReport.updateMany({
    where: { reviewedByUserId: shadowUserId },
    data: { reviewedByUserId: logtoUserId },
  });
}

async function preserveShadowUserGrants(
  tx: Prisma.TransactionClient,
  shadowUser: {
    isSuperUser: boolean;
    uploadsEnabled: boolean;
    uploadAllowanceBytes: number;
  },
  logtoUserId: string,
): Promise<void> {
  const logtoUser = await tx.user.findUnique({
    where: { id: logtoUserId },
    select: {
      isSuperUser: true,
      uploadsEnabled: true,
      uploadAllowanceBytes: true,
    },
  });

  if (!logtoUser) {
    throw new Error(`Logto user ${logtoUserId} disappeared during Discord shadow merge`);
  }

  await tx.user.update({
    where: { id: logtoUserId },
    data: {
      isSuperUser: logtoUser.isSuperUser || shadowUser.isSuperUser,
      uploadsEnabled: logtoUser.uploadsEnabled || shadowUser.uploadsEnabled,
      uploadAllowanceBytes: Math.max(
        logtoUser.uploadAllowanceBytes,
        shadowUser.uploadAllowanceBytes,
      ),
    },
  });
}

export async function mergeDiscordShadowUser({
  prisma,
  shadowUserId,
  logtoUserId,
  discordUserId,
}: MergeDiscordShadowUserInput): Promise<MergeDiscordShadowUserResult> {
  if (shadowUserId === logtoUserId) {
    return { status: 'noop' };
  }

  return prisma.$transaction(async (tx) => {
    const discordAccount = await tx.account.findUnique({
      where: {
        providerId_accountId: {
          providerId: 'discord',
          accountId: discordUserId,
        },
      },
      select: { id: true, userId: true },
    });

    if (!discordAccount || discordAccount.userId === logtoUserId) {
      return { status: 'noop' };
    }

    const shadowUser = await tx.user.findUnique({
      where: { id: shadowUserId },
      select: {
        email: true,
        isSuperUser: true,
        uploadsEnabled: true,
        uploadAllowanceBytes: true,
      },
    });

    if (shadowUser?.email !== discordUserIdToAuthEmail(discordUserId)) {
      return { status: 'not-shadow', shadowUserId, discordUserId };
    }

    await preserveShadowUserGrants(tx, shadowUser, logtoUserId);
    await reassignUserOwnedRecords(tx, shadowUserId, logtoUserId);

    await tx.session.deleteMany({
      where: { userId: shadowUserId },
    });

    await tx.account.update({
      where: { id: discordAccount.id },
      data: { userId: logtoUserId },
    });

    await tx.user.delete({
      where: { id: shadowUserId },
    });

    return { status: 'merged', shadowUserId, logtoUserId, discordUserId };
  });
}
