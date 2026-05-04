import { JobDescriptionForm } from "@/components/job-description/job-description-form";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Албан тушаалын тодорхойлолт
            </h1>
            <p className="text-muted-foreground">
              Албан тушаалын дэлгэрэнгүй мэдээллийг оруулна уу
            </p>
          </div>
          <JobDescriptionForm />
        </div>
      </div>
    </main>
  );
}
