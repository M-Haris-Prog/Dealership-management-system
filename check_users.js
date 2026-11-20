const { PrismaClient } = require('./apps/api/node_modules/@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({
    include: { userRoles: { include: { role: true } } }
  });
  for (const u of users) {
    console.log(u.username, u.email, u.userRoles.map(ur => ur.role.name));
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
