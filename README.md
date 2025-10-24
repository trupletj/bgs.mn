# Сэлбэг захиалгын системын архитектур, болон workflow

## Өгөгдлийн сангийн бүтэц

- order_items - Захиалгад агуулагдах барааны мэдээллүүд багтана.
- sub_order_item - Захиалгын бараа шат дараатайгаар баталгаажуулах явцад хэн нэгэн өөрчлөлт оруулсан бол энд хадгалагдана.
- orders - Захиалгын мэдээлэл (төрөл, яаралтай байдал), хугацаа мөн хэн үүсгэсэн болон аль шатанд явж буйг харуулна.
- order_workflow - Захиалгын урсгалыг харуулахад тусална. from_stat to_status
- order_reviewers - Захиалгад өөрчлөлт оруулах хүмүүсийг захиалгатай нь холбосон хэсэг. Хэзээ тэр хүмүүс холбогдсон, аль шатны (а/дарга, у/дарга гэх мэт /profile_id/) хүмүүс холбогдсон, хэн тэр хүн рүү илгээсэн эсэхийг харах боломжтой талбар
- order_revision - ????

## WorkFlow

1. Ажилтан захиалга өгөхөд дараагийн шатны рүү илгээнэ. Тэдгээр хүмүүс нь step_first гэх reviewer_type-тайгаар order_reviewers-д бүртгэгдэнэ. Тэдгээр хүмүүсийн role нь role_id = 9 байна.
2. Ажилтанд захиалга илгээгдсэн төлөвтэй харагдана.
3. Step_first-н хэрэглэгчид захиалгыг approve, reject болон changed_approved хийх боломжтой байна. reject хийвэл process дуусна. Approve болон changed_approved хийвэл цааш step_second гэх reviewer_type-тай-гаар order_reviewers-д бүртгэнэ. Ингэхдээ дараагийн хүнээ сонгоно тэр хүн нь өөрийн role_id + 1 буюу role_id = 10 байна. Changed_approved үед тухайн барааны тоо өөрчлөгдсөн үед order_items нь sub_order_items-д хадгалагдана.
4. Step_second-н хэрэглэгчдэд өмнөх шатны бүх хүмүүсийн approved болон changed_approved-ууд харагдах ёстой.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

# Журам бүртгэл болон хэрэгжилтийн үнэлгээний систем

Журам бүртгэл болон хэрэгжилтийн үнэлгээний систем нь журам түүн агуулагдах бүлэг, заалтыг бүртгэдэг байхад оршино. Тухайн журмын заалтуудтай ажлын байр холбож, ажлын байрны

## Өгөгдлийн сангийн бүтэц

- policy - Журам
- section - Бүлэг
- clause - Заалт
- job_position - Ажлын байр
- clause_job_position - Relation of clause

## WorkFlow
