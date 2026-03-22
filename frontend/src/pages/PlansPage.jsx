import { useState } from 'react'
import { Link } from 'react-router-dom'
import TopNavBar from '../components/TopNavBar'
import { useAuth } from '../context/AuthContext'

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    priceLabel: 'Free forever',
    description: 'Essential safety features to get started.',
    color: 'from-slate-500 to-slate-700',
    badge: 'bg-slate-100 text-slate-700',
    features: [
      { name: 'Safety Heatmap', included: true },
      { name: 'Submit Safety Reports', included: true },
      { name: 'Basic Safe Routes', included: true },
      { name: 'Emergency SOS Button', included: true },
      { name: 'Rewards & Credits System', included: true },
      { name: 'Family Circle', included: true, limit: 'Up to 3 members' },
      { name: 'City Coverage', included: true, limit: '1 city' },
      { name: 'Report History', included: true, limit: 'Last 30 days' },
      { name: 'Codeword Safety System', included: true },
      { name: 'Priority Safe Routes', included: false },
      { name: 'Detailed Area Analytics', included: false },
      { name: 'Priority Emergency Response', included: false },
      { name: 'Voice Guardian (Auto-detect)', included: false },
      { name: 'Offline Safety Maps', included: false },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 99,
    priceLabel: '99/mo',
    description: 'Enhanced safety for daily commuters and night travelers.',
    color: 'from-primary to-emerald-600',
    badge: 'bg-primary/10 text-primary',
    popular: true,
    features: [
      { name: 'Everything in Free', included: true, highlight: true },
      { name: 'Priority Safe Routes', included: true, isNew: true },
      { name: 'Detailed Area Analytics', included: true, isNew: true },
      { name: 'Voice Guardian (Auto-detect)', included: true, isNew: true },
      { name: 'Family Circle', included: true, limit: 'Up to 10 members' },
      { name: 'City Coverage', included: true, limit: 'Up to 3 cities' },
      { name: 'Report History', included: true, limit: 'Unlimited' },
      { name: 'Image-Verified Reports Priority', included: true },
      { name: '2x Credit Earning Boost', included: true, isNew: true },
      { name: 'Ad-Free Experience', included: true },
      { name: 'Priority Emergency Response', included: false },
      { name: 'Offline Safety Maps', included: false },
      { name: 'Dedicated Support Line', included: false },
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 249,
    priceLabel: '249/mo',
    description: 'Maximum protection for you and your entire family.',
    color: 'from-amber-500 to-orange-600',
    badge: 'bg-amber-100 text-amber-700',
    features: [
      { name: 'Everything in Pro', included: true, highlight: true },
      { name: 'Priority Emergency Response', included: true, isNew: true },
      { name: 'Offline Safety Maps', included: true, isNew: true },
      { name: 'Dedicated 24/7 Support Line', included: true, isNew: true },
      { name: 'Family Circle', included: true, limit: 'Unlimited members' },
      { name: 'City Coverage', included: true, limit: 'All cities' },
      { name: '5x Credit Earning Boost', included: true, isNew: true },
      { name: 'Real-time Crowd Density Data', included: true, isNew: true },
      { name: 'Police Patrol Schedules', included: true, isNew: true },
      { name: 'Custom Safety Alerts by Area', included: true },
      { name: 'Family Location History (90 days)', included: true },
      { name: 'Priority Bounty Access', included: true },
      { name: 'Early Access to New Features', included: true },
    ],
  },
]

export default function PlansPage() {
  const { user } = useAuth()
  const [currentPlan] = useState('free')
  const [billingCycle, setBillingCycle] = useState('monthly')

  const getPrice = (plan) => {
    if (plan.price === 0) return 'Free'
    const price = billingCycle === 'yearly' ? Math.round(plan.price * 10) : plan.price
    return `INR ${price}`
  }

  const getPeriod = (plan) => {
    if (plan.price === 0) return 'forever'
    return billingCycle === 'yearly' ? '/year (save 17%)' : '/month'
  }

  return (
    <div className="min-h-screen bg-surface-container-low">
      <TopNavBar title="Plans" subtitle="Upgrade" />

      <main className="p-4 md:p-8 max-w-6xl mx-auto pb-24 md:pb-8">
        <Link to="/rewards" className="inline-flex items-center gap-1 text-sm font-semibold text-primary mb-4 hover:underline">
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Back to Rewards
        </Link>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-4xl font-extrabold text-on-surface tracking-tight font-headline">Choose Your Plan</h1>
          <p className="text-on-surface-variant mt-2 text-sm md:text-base max-w-lg mx-auto">
            Upgrade for more protection, larger family circles, and premium safety features.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <span className={`text-sm font-semibold ${billingCycle === 'monthly' ? 'text-on-surface' : 'text-on-surface-variant'}`}>Monthly</span>
            <button
              onClick={() => setBillingCycle(b => b === 'monthly' ? 'yearly' : 'monthly')}
              className={`relative w-14 h-8 rounded-full transition-colors ${billingCycle === 'yearly' ? 'bg-primary' : 'bg-surface-container-highest'}`}
            >
              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all ${billingCycle === 'yearly' ? 'left-7' : 'left-1'}`}></div>
            </button>
            <span className={`text-sm font-semibold ${billingCycle === 'yearly' ? 'text-on-surface' : 'text-on-surface-variant'}`}>
              Yearly
              <span className="ml-1 px-2 py-0.5 bg-primary-fixed text-on-primary-fixed-variant text-[10px] font-bold rounded-full">Save 17%</span>
            </span>
          </div>
        </div>

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {PLANS.map(plan => {
            const isCurrent = plan.id === currentPlan
            const isPopular = plan.popular

            return (
              <div
                key={plan.id}
                className={`relative bg-surface-container-lowest rounded-2xl md:rounded-3xl shadow-sm border overflow-hidden flex flex-col ${
                  isPopular
                    ? 'border-primary/30 ring-2 ring-primary/20 shadow-lg shadow-primary/5'
                    : 'border-outline-variant/10'
                }`}
              >
                {/* Popular Badge */}
                {isPopular && (
                  <div className="bg-primary text-white text-center py-1.5 text-[10px] font-bold uppercase tracking-widest">
                    Most Popular
                  </div>
                )}

                <div className="p-5 md:p-6 flex-1 flex flex-col">
                  {/* Plan Header */}
                  <div className="mb-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${plan.badge}`}>
                        {plan.name}
                      </span>
                      {isCurrent && (
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1 mt-3">
                      <span className="text-3xl md:text-4xl font-extrabold text-on-surface tracking-tight">{getPrice(plan)}</span>
                      <span className="text-sm text-on-surface-variant font-medium">{getPeriod(plan)}</span>
                    </div>
                    <p className="text-sm text-on-surface-variant mt-2">{plan.description}</p>
                  </div>

                  {/* Features List */}
                  <div className="flex-1 space-y-2.5 mb-6">
                    {plan.features.map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-2.5">
                        <span
                          className={`material-symbols-outlined text-[18px] mt-0.5 shrink-0 ${
                            feature.included ? 'text-primary' : 'text-on-surface-variant/30'
                          }`}
                          style={feature.included ? { fontVariationSettings: "'FILL' 1" } : undefined}
                        >
                          {feature.included ? 'check_circle' : 'cancel'}
                        </span>
                        <div className="flex-1">
                          <span className={`text-sm ${
                            feature.included
                              ? feature.highlight ? 'font-bold text-on-surface' : 'text-on-surface'
                              : 'text-on-surface-variant/40 line-through'
                          }`}>
                            {feature.name}
                          </span>
                          {feature.limit && (
                            <span className="ml-1.5 text-xs font-semibold text-primary">{feature.limit}</span>
                          )}
                          {feature.isNew && (
                            <span className="ml-1.5 px-1.5 py-0.5 bg-primary-fixed text-on-primary-fixed-variant text-[9px] font-bold rounded uppercase">New</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* CTA Button */}
                  {isCurrent ? (
                    <div className="py-3 text-center bg-surface-container rounded-xl text-sm font-bold text-on-surface-variant">
                      Current Plan
                    </div>
                  ) : (
                    <button
                      className={`w-full py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98] ${
                        isPopular
                          ? 'bg-primary text-white shadow-md shadow-primary/20 hover:bg-primary/90'
                          : plan.id === 'premium'
                            ? 'bg-linear-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/20 hover:opacity-90'
                            : 'bg-surface-container-highest text-on-surface hover:bg-surface-container-high'
                      }`}
                    >
                      {plan.price === 0 ? 'Get Started' : `Upgrade to ${plan.name}`}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Comparison Table - Desktop */}
        <div className="hidden md:block mt-12">
          <h2 className="text-xl font-bold text-on-surface font-headline mb-6 text-center">Feature Comparison</h2>
          <div className="bg-surface-container-lowest rounded-3xl shadow-sm border border-outline-variant/5 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-outline-variant/10">
                  <th className="text-left px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Feature</th>
                  {PLANS.map(p => (
                    <th key={p.id} className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 rounded-lg text-xs font-bold ${p.badge}`}>{p.name}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {[
                  { label: 'Family Circle Members', values: ['3', '10', 'Unlimited'] },
                  { label: 'City Coverage', values: ['1 city', '3 cities', 'All cities'] },
                  { label: 'Report History', values: ['30 days', 'Unlimited', 'Unlimited'] },
                  { label: 'Credit Earning Boost', values: ['1x', '2x', '5x'] },
                  { label: 'Safety Heatmap', values: [true, true, true] },
                  { label: 'Emergency SOS', values: [true, true, true] },
                  { label: 'Safe Routes', values: ['Basic', 'Priority', 'Priority'] },
                  { label: 'Area Analytics', values: [false, true, true] },
                  { label: 'Voice Guardian', values: [false, true, true] },
                  { label: 'Priority Emergency', values: [false, false, true] },
                  { label: 'Offline Maps', values: [false, false, true] },
                  { label: '24/7 Support Line', values: [false, false, true] },
                  { label: 'Crowd Density Data', values: [false, false, true] },
                  { label: 'Police Patrol Schedules', values: [false, false, true] },
                ].map((row, idx) => (
                  <tr key={idx} className="hover:bg-surface-container-low/30 transition-colors">
                    <td className="px-6 py-3.5 text-sm font-medium text-on-surface">{row.label}</td>
                    {row.values.map((val, i) => (
                      <td key={i} className="px-6 py-3.5 text-center">
                        {val === true ? (
                          <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                        ) : val === false ? (
                          <span className="material-symbols-outlined text-on-surface-variant/20 text-lg">cancel</span>
                        ) : (
                          <span className="text-sm font-semibold text-on-surface">{val}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-10 max-w-2xl mx-auto">
          <h2 className="text-xl font-bold text-on-surface font-headline mb-6 text-center">Frequently Asked Questions</h2>
          <div className="space-y-3">
            <FaqItem
              q="Can I cancel anytime?"
              a="Yes! You can downgrade or cancel your plan at any time. You'll keep access until the end of your billing period."
            />
            <FaqItem
              q="Do credits carry over if I change plans?"
              a="Absolutely. Your earned credits are yours forever regardless of plan changes."
            />
            <FaqItem
              q="Is my family circle data safe?"
              a="Yes. All location data is encrypted end-to-end. Only circle members can see each other's locations."
            />
            <FaqItem
              q="What happens when I hit the city limit?"
              a="On the Free plan, reports outside your primary city still work but won't appear in your personalized heatmap. Upgrade to expand."
            />
          </div>
        </div>
      </main>
    </div>
  )
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/5 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-4 flex items-center justify-between text-left"
      >
        <span className="text-sm font-bold text-on-surface">{q}</span>
        <span className={`material-symbols-outlined text-on-surface-variant text-lg transition-transform ${open ? 'rotate-180' : ''}`}>
          expand_more
        </span>
      </button>
      {open && (
        <div className="px-5 pb-4 -mt-1">
          <p className="text-sm text-on-surface-variant leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  )
}
