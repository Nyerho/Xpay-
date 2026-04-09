import { prisma } from "./prisma";

export async function createNotification(params: {
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string | null;
}) {
  await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      link: params.link ?? null,
    },
  });
}

