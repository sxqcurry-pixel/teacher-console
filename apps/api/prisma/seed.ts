/**
 * Seed script — run via `pnpm --filter api db:seed`
 * Creates one demo teacher, one class and a handful of students,
 * enough to showcase the dashboard & CRUD flows without external data.
 */
import { PrismaClient, Role, StudentStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'teacher@spark.dev';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.info('[seed] demo user already exists, skipping');
    return;
  }

  const hashed = await bcrypt.hash('Spark@123456', 10);
  const teacher = await prisma.user.create({
    data: {
      email,
      password: hashed,
      name: '星火数学老师',
      avatar: null,
      role: Role.TEACHER,
    },
  });

  const cls = await prisma.class.create({
    data: {
      name: '初二数学火箭班',
      grade: '初二',
      subject: '数学',
      teacherId: teacher.id,
      lessons: {
        createMany: {
          data: [
            { index: 1, title: '第1讲 二次函数入门', fullScore: 30 },
            { index: 2, title: '第2讲 二次函数图像与性质', fullScore: 30 },
            { index: 3, title: '第3讲 二次函数应用', fullScore: 30 },
          ],
        },
      },
    },
  });

  const names = [
    '陈一诺', '张思远', '李明轩', '王子涵', '刘雨桐',
    '赵逸凡', '孙锦程', '周子墨', '吴可欣', '郑嘉豪',
    '冯怡然', '蒋文博', '韩雨桐', '杨悦琪', '朱鹏宇',
  ];
  await prisma.student.createMany({
    data: names.map((name, idx) => ({
      serialNo: idx + 1,
      name,
      status: StudentStatus.ACTIVE,
      classId: cls.id,
      remark: idx % 3 === 0 ? '基础扎实，需拔高' : idx % 3 === 1 ? '计算容易出错' : '态度认真',
    })),
  });

  // Todos
  await prisma.todo.createMany({
    data: [
      { userId: teacher.id, title: '明天第1讲备课：二次函数图像', category: 'LESSON_PREP', dueDate: new Date(Date.now() + 86400_000) },
      { userId: teacher.id, title: '跟进陈一诺家长续费', category: 'RENEWAL', dueDate: new Date(Date.now() + 2 * 86400_000) },
      { userId: teacher.id, title: '批改第1讲出门测', category: 'FOLLOW_UP' },
      { userId: teacher.id, title: '填写学生积分明细提交教务', category: 'ADMIN' },
    ],
  });

  console.info(`[seed] done. teacher=${teacher.email} class=${cls.id} students=${names.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
