import React, { useState, useEffect } from 'react';
import { Calculator, TrendingUp, TrendingDown, DollarSign, Activity, AlertTriangle } from 'lucide-react';

export default function TrueCostDashboard({ products, tenantId }: { products: any[], tenantId: string }) {
  const [costData, setCostData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchCosts = async () => {
      setLoading(true);
      const newCostData: Record<string, any> = {};
      for (const p of products) {
        try {
          const res = await fetch(`/api/cost-engine/true-cost/${p.id}`, {
            headers: { 'x-tenant-id': tenantId }
          });
          if (res.ok) {
            newCostData[p.id] = await res.json();
          }
        } catch (e) {
          console.error(e);
        }
      }
      setCostData(newCostData);
      setLoading(false);
    };

    if (products.length > 0 && tenantId) {
      fetchCosts();
    }
  }, [products, tenantId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-600/20">
          <Calculator className="text-white" size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-800">True Cost Engine Dashboard</h2>
          <p className="text-sm text-slate-500 font-medium">Deep analysis of operational allocation & real margin</p>
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-6 py-1">
            <div className="h-2 bg-slate-200 rounded"></div>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-4">
                <div className="h-24 bg-slate-200 rounded col-span-1"></div>
                <div className="h-24 bg-slate-200 rounded col-span-1"></div>
                <div className="h-24 bg-slate-200 rounded col-span-1"></div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map(product => {
            const data = costData[product.id];
            if (!data) return null;

            return (
              <div key={product.id} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform">
                  <Activity size={64} />
                </div>
                
                <h3 className="text-lg font-black text-slate-800 mb-4">{data.name}</h3>

                <div className="space-y-4 mb-6">
                  <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                    <span className="text-slate-500 font-medium">Selling Price:</span>
                    <span className="font-black text-slate-800">Rp {data.sellingPrice.toLocaleString()}</span>
                  </div>

                  {/* Material Cost Breakdown */}
                  <div>
                    <div className="flex justify-between items-center text-sm mb-1">
                      <span className="text-slate-900 font-bold">Material Cost:</span>
                      <span className="font-bold text-rose-600 font-mono">- Rp {Math.round(data.materialCost).toLocaleString()}</span>
                    </div>
                    {data.materialBreakdown && data.materialBreakdown.length > 0 && (
                      <div className="pl-3 border-l-2 border-slate-100 space-y-1 mt-1">
                        {data.materialBreakdown.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center text-xs">
                            <span className="text-slate-500">{item.name}</span>
                            <span className="text-slate-400 font-mono">Rp {Math.round(item.amount).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Operational Allocation Breakdown */}
                  <div>
                    <div className="flex justify-between items-center text-sm mb-1">
                      <span className="text-slate-900 font-bold">Overhead Allocation:</span>
                      <span className="font-bold text-rose-600 font-mono">- Rp {Math.round(data.operationalCost).toLocaleString()}</span>
                    </div>
                    {data.operationalBreakdown && data.operationalBreakdown.length > 0 ? (
                      <div className="pl-3 border-l-2 border-slate-100 space-y-1 mt-1">
                        {data.operationalBreakdown.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center text-xs">
                            <span className="text-slate-500">{item.category}</span>
                            <span className="text-slate-400 font-mono">Rp {Math.round(item.amount).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                       <div className="pl-3 border-l-2 border-slate-100 text-xs text-slate-400 italic">No overhead mapped</div>
                    )}
                  </div>

                  {data.tax > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-900 font-bold">Tax Alloc:</span>
                      <span className="font-bold text-amber-600 font-mono">- Rp {Math.round(data.tax).toLocaleString()}</span>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100 mb-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-bold text-slate-900">Total True Cost</span>
                    <span className="text-sm font-black text-slate-900 font-mono">Rp {Math.round(data.totalTrueCost).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-emerald-600">Real Profit</span>
                    <span className="text-sm font-black text-emerald-600 font-mono">Rp {Math.round(data.realProfit).toLocaleString()}</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl flex items-center justify-between border border-slate-100">
                   <div className="flex items-center gap-2">
                     <TrendingUp size={18} className={data.margin > 40 ? "text-emerald-500" : "text-amber-500"} />
                     <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Margin</span>
                   </div>
                   <div className={`text-xl font-black ${data.margin > 40 ? 'text-emerald-600' : 'text-amber-600'}`}>
                     {data.margin.toFixed(1)}%
                   </div>
                </div>
                
                {data.recommendation && (
                  <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-2 text-xs text-amber-800 font-medium">
                     <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-600" />
                     <p>{data.recommendation}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
