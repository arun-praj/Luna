import {
  Banknote,
  Baby,
  Bike,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CakeSlice,
  CarFront,
  ChartNoAxesColumnIncreasing,
  Clapperboard,
  CircleDollarSign,
  Coins,
  Coffee,
  CreditCard,
  Dumbbell,
  FileText,
  Fuel,
  Gamepad2,
  Gift,
  Globe2,
  GraduationCap,
  HandCoins,
  HeartPulse,
  House,
  Landmark,
  Laptop,
  MapPin,
  Music2,
  Phone,
  Pill,
  PawPrint,
  Plane,
  Receipt,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  ShoppingBasket,
  ShoppingCart,
  Sprout,
  Tags,
  Ticket,
  TrainFront,
  Utensils,
  WalletCards,
  Waves,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

const categoryIconMap: Record<string, LucideIcon> = {
  Plants: Sprout, Home: House, Housing: House, Food: Utensils, "Food & Drinks": Utensils,
  "Online Shopping": ShoppingBag, OnlineShopping: ShoppingBag, ShoppingBag,
  Shopping: ShoppingCart, "Shopping Cart": ShoppingCart, ShoppingCart,
  Groceries: ShoppingBasket, Travel: CarFront, Flights: Plane, Health: HeartPulse,
  Fitness: Dumbbell, "Fitness & Sports": Dumbbell, Gifts: Gift, Work: BriefcaseBusiness,
  Wallet: WalletCards, Cash: Banknote, Education: GraduationCap, Pets: PawPrint, Pet: PawPrint,
  Movies: Clapperboard, "Movies & Entertainment": Clapperboard, "Entertainment & Movies": Clapperboard,
  Insurance: ShieldCheck, Car: CarFront, Transport: TrainFront, Vehicles: Bike,
  Salary: CircleDollarSign, Freelancing: Laptop, Investments: ChartNoAxesColumnIncreasing,
  FD: Coins, Loans: HandCoins, Family: Baby, Entertainment: Gamepad2, Music: Music2,
  Restaurants: Utensils, Coffee, Clothing: Shirt, Bills: FileText, Utilities: Zap,
  Rent: Building2, Phone, Internet: Wifi, Subscriptions: Ticket, Fuel, Medicine: Pill,
  Bank: Landmark, Savings: WalletCards, CreditCard, TravelMap: MapPin, Vacation: Globe2,
  Repairs: Wrench, Events: CakeSlice, Charity: HandCoins, Hobbies: Waves, Receipts: Receipt,
  Books: BookOpen,
};

const categoryForegroundMap: Record<string, string> = {
  "#e3eee9": "#356b68", "#f8e9e6": "#9e514b", "#f3e8d4": "#95631e",
  "#e3eff6": "#436f9a", "#e5f3eb": "#2f7d5a", "#ece6f3": "#735b8f", "#fbe8dc": "#a9512e",
};

export function getCategoryIcon(icon: string | null | undefined, name?: string) {
  return (icon && categoryIconMap[icon]) || (name && categoryIconMap[name]) || Tags;
}

export function getCategoryForeground(color: string | null | undefined) {
  return categoryForegroundMap[color?.toLowerCase() ?? ""] ?? "#356b68";
}
