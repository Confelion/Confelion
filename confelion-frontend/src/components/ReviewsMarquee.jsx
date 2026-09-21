const reviews = [
  {text: "Rahul, Delhi — Fabric feels premium", city: "Delhi"},
  {text: "Aman, Chandigarh — Perfect fitting", city: "Chandigarh"},
  {text: "Kunal, Mumbai — Looks expensive", city: "Mumbai"},
  {text: "Rohit, Jaipur — Top-notch quality", city: "Jaipur"},
  {text: "Arjun, Pune — Super comfortable", city: "Pune"},
  {text: "Nikhil, Indore — Clean stitching", city: "Indore"},
  {text: "Saurabh, Noida — Worth every rupee", city: "Noida"},
  {text: "Manish, Bhopal — Fit is spot on", city: "Bhopal"},
  {text: "Vikas, Gurugram — Love the fabric", city: "Gurugram"},
  {text: "Akash, Patna — Great finishing", city: "Patna"},
  {text: "Pranav, Nagpur — Looks classy", city: "Nagpur"},
  {text: "Deepak, Surat — Will buy again", city: "Surat"},
]

export default function ReviewsMarquee() {
  const allReviews = [...reviews, ...reviews]

  return (
    <section className="reviews-marquee bg-white py-10 md:py-14" aria-labelledby="reviews-heading">
      <div className="max-w-7xl mx-auto px-6">
        <div className="review-head mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h2 id="reviews-heading" className="text-xl md:text-2xl font-black tracking-tight">What customers say</h2>
          <p className="text-sm text-zinc-500">Real people, real cities</p>
        </div>
        
        <div className="marquee-row" role="list" aria-label="Customer reviews">
          <div className="track" aria-live="polite">
            {allReviews.map((review, index) => (
              <div key={index} className="pill" role="listitem">
                {review.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}