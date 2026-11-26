import Link from "next/link";

interface BottomNavProps {
  active: "home" | "orders" | "profile";
}

const NAV_ITEMS: Array<{
  key: BottomNavProps["active"];
  href: string;
  icon: string;
  label: string;
}> = [
  { key: "home", href: "/", icon: "🏠", label: "Cari Foto" },
  { key: "orders", href: "/orders", icon: "🛒", label: "Pesanan" },
  { key: "profile", href: "/profile", icon: "👤", label: "Profil" },
];

export default function BottomNav({ active }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#302A3A] bg-[#23143D]/95 px-4 py-2 backdrop-blur-md">
      <div className="mx-auto flex max-w-md items-center justify-around">
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.key;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={
                isActive
                  ? "flex flex-col items-center gap-1 rounded-xl bg-[#7B4FE0] px-4 py-1.5 text-xs font-bold text-white shadow-lg shadow-[#7B4FE0]/30"
                  : "flex flex-col items-center gap-1 rounded-xl px-4 py-1.5 text-xs font-bold text-[#9E8DBE] transition-all hover:text-white"
              }
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
