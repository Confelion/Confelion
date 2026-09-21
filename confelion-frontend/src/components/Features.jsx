import { Truck, Package, RotateCcw, Shield } from 'lucide-react'

const features = [
  {
    icon: <Truck className="w-6 h-6" />,
    title: "Free Shipping Across India",
    description: "On orders over ₹999",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  {
    icon: <Package className="w-6 h-6" />,
    title: "COD Available",
    description: "Pay when you receive",
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    icon: <RotateCcw className="w-6 h-6" />,
    title: "Easy 7-Day Returns",
    description: "Hassle-free returns",
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: "Premium Fabric Quality",
    description: "Impeccable craftsmanship",
    color: "text-violet-600",
    bg: "bg-violet-50",
  }
]

export default function Features() {
  return (
    <section className="features-section py-12 md:py-16" aria-labelledby="features-heading">
      <h2 id="features-heading" className="sr-only">Our Features</h2>
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {features.map((feature, index) => (
            <div key={index} className="feature-card text-center p-5 md:p-6 rounded-2xl bg-white border border-zinc-100">
              <div className={`feature-icon ${feature.color} mb-4 mx-auto w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-2xl ${feature.bg}`}>
                {feature.icon}
              </div>
              <h3 className="font-black text-sm md:text-base tracking-wide mb-1">{feature.title}</h3>
              <p className="text-xs md:text-sm text-zinc-500">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
