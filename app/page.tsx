import { createClient } from "@/lib/supabase/server";
import { HeroSection } from "@/components/home/HeroSection";
// import { FeaturesSection } from "@/components/home/FeaturesSection"; // ← تم تعليق FeaturesSection
import { ServicesSection } from "@/components/home/ServicesSection";
import { CTASection } from "@/components/home/CTASection";

interface HomePageProps {
  searchParams: { barber?: string };
}

interface BarberProfile {
  id: string;
  name: string;
  bio: string | null;
  experience_years: number | null;
}

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  price: number | null;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const supabase = await createClient();

  // Fetch barber profile - use barber_id from query params or default to first
  let barberProfile: BarberProfile | null = null;

  if (searchParams.barber) {
    const { data } = await supabase
      .from("barber_profile")
      .select("*")
      .eq("id", searchParams.barber)
      .limit(1);
    barberProfile = ((data as BarberProfile[] | null) ?? [])[0] ?? null;
  } else {
    const { data } = await supabase
      .from("barber_profile")
      .select("*")
      .limit(1);
    barberProfile = ((data as BarberProfile[] | null) ?? [])[0] ?? null;
  }

  // Fetch services
  const { data: servicesData } = await supabase
    .from("services")
    .select("*")
    .order("duration", { ascending: true });

  const services = (servicesData as Service[] | null) ?? null;

  return (
    <div className="min-h-screen" dir="rtl">
      <HeroSection bio={barberProfile?.bio ?? null} />
      {/* <FeaturesSection /> */} {/* ← تم تعليق FeaturesSection */}
      {services && services.length > 0 && (
        <ServicesSection services={services} />
      )}
      <CTASection />
    </div>
  );
}