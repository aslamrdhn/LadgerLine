import React, { useState, useEffect } from 'react';
import { RefreshCw, Search, CheckCircle2, AlertTriangle, FileText, Download, UploadCloud, ChevronRight, X } from 'lucide-react';

export default function MigrationCenter() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/migration/requests');
      const data = await res.json();
      if (Array.isArray(data)) {
        setRequests(data);
      } else {
        console.error('Expected array, got:', data);
        setRequests([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'PENDING': return 'bg-slate-800 text-slate-300';
      case 'WAITING_FILE': return 'bg-yellow-900/50 text-yellow-400';
      case 'MAPPING': return 'bg-blue-900/50 text-blue-400';
      case 'VALIDATION': return 'bg-orange-900/50 text-orange-400';
      case 'READY_TO_IMPORT': return 'bg-emerald-900/50 text-emerald-400';
      case 'COMPLETED': return 'bg-emerald-600 text-white';
      case 'REJECTED': return 'bg-rose-900/50 text-rose-400';
      default: return 'bg-slate-800 text-slate-300';
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await fetch(`/api/migration/requests/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      fetchRequests();
      if (selectedRequest && selectedRequest.id === id) {
        setSelectedRequest({ ...selectedRequest, status });
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (selectedRequest) {
    return <MigrationWorkspace request={selectedRequest} onBack={() => { setSelectedRequest(null); fetchRequests(); }} />;
  }

  return (
    <div className="p-6 text-slate-200">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            Migration Center
          </h1>
          <p className="text-sm text-slate-400 mt-1">Human-Assisted Smart Migration Workspace.</p>
        </div>
        <button onClick={fetchRequests} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300">
           <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-700 bg-slate-900/60 flex justify-between items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input 
                 type="text" 
                 placeholder="Search tenant or POS..." 
                 className="bg-slate-950 border border-slate-700 text-sm text-white pl-9 pr-4 py-1.5 rounded-lg focus:outline-none focus:border-indigo-500"
              />
            </div>
            
            <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg text-sm font-bold shadow flex items-center gap-2">
               <span>New Migration Request</span>
            </button>
        </div>
        
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-900 border-b border-slate-700 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3 font-bold">Tenant Name</th>
              <th className="px-4 py-3 font-bold">Previous POS</th>
              <th className="px-4 py-3 font-bold">Status</th>
              <th className="px-4 py-3 font-bold">Files</th>
              <th className="px-4 py-3 font-bold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {requests.map((req) => (
              <tr key={req.id} className="hover:bg-slate-700/30 transition-colors">
                <td className="px-4 py-3 font-bold text-white">{req.tenant?.storeName || req.tenantId}</td>
                <td className="px-4 py-3"><span className="bg-slate-900 border border-slate-700 px-2 py-0.5 rounded font-mono text-[10px] text-slate-300">{req.previousPos || 'Unknown'}</span></td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-[9px] font-bold tracking-wider ${getStatusColor(req.status)}`}>
                    {req.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <FileText size={14} /> {req.files?.length || 0} files
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button 
                    onClick={() => setSelectedRequest(req)}
                    className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-bold transition-colors"
                  >
                    Open Workspace
                  </button>
                </td>
              </tr>
            ))}
            
            {requests.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                   No migration requests found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MigrationWorkspace({ request, onBack }: { request: any, onBack: () => void }) {
  const [csvData, setCsvData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<{name: string, price: string, category: string, costPrice: string}>({ name: '', price: '', category: '', costPrice: '' });
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split('\n');
      if (lines.length > 0) {
        const fileHeaders = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        setHeaders(fileHeaders);
        
        const results = [];
        for(let i=1; i<lines.length; i++) {
          if(!lines[i].trim()) continue;
          const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          const obj: any = {};
          fileHeaders.forEach((h, idx) => { obj[h] = values[idx]; });
          results.push(obj);
        }
        setCsvData(results);
      }
    };
    reader.readAsText(file);
  };

  const validateData = () => {
    if (!mapping.name) return alert('Name column must be mapped');
    const existingNames = new Set();
    const dups = [];
    csvData.forEach((row, i) => {
      const name = row[mapping.name];
      if (name) {
        if (existingNames.has(name.toLowerCase())) {
          dups.push({ row: i+2, name });
        }
        existingNames.add(name.toLowerCase());
      }
    });
    setDuplicates(dups);
    if (dups.length === 0) {
      alert('Validation passed! No duplicates found.');
    }
  };

  const handleImport = async () => {
    if (!mapping.name || !mapping.price) return alert('Name and Price are required mapping fields.');
    setImporting(true);

    const mappedProducts = csvData.map(row => ({
      name: row[mapping.name] || 'Unknown',
      category: mapping.category ? row[mapping.category] : 'Uncategorized',
      price: mapping.price ? Number(row[mapping.price]) : 0,
      costPrice: mapping.costPrice ? Number(row[mapping.costPrice]) : 0,
    }));

    try {
      const res = await fetch(`/api/migration/requests/${request.id}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: request.tenantId,
          mappedProducts
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Successfully imported ${data.imported} products!`);
        onBack();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (e) {
      alert('Network error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="p-6 text-slate-200 min-h-screen animate-fade-in">
      <button onClick={onBack} className="mb-4 text-indigo-400 flex items-center text-sm font-bold hover:text-indigo-300">
        <ChevronRight className="rotate-180 mr-1" size={16} /> Kembali ke Daftar
      </button>
      
      <div className="flex gap-6">
        <div className="w-1/3 space-y-4">
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 shadow-xl">
            <h2 className="text-xl font-bold text-white mb-1">Customer Migration workspace</h2>
            <p className="text-slate-400 text-sm mb-4">Upload and map source POS data.</p>
            
            <div className="space-y-3 mt-4">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Tenant</p>
                <p className="font-bold">{request.tenant?.storeName || request.tenantId}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Previous POS</p>
                <p className="font-mono bg-slate-900 px-2 py-1 rounded text-sm w-max border border-slate-700">{request.previousPos || 'Unknown'}</p>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-700 pt-4">
               <label className="w-full flex-col flex items-center justify-center p-4 border-2 border-dashed border-slate-600 rounded-lg hover:border-indigo-500 hover:bg-indigo-900/20 cursor-pointer transition-all">
                  <UploadCloud className="text-indigo-400 mb-2" size={24} />
                  <span className="text-xs font-bold text-slate-300">Upload CSV Export provided by Customer</span>
                  <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
               </label>
               {csvData.length > 0 && <p className="text-xs text-emerald-400 mt-2 font-bold text-center">Loaded {csvData.length} rows</p>}
            </div>

            {csvData.length > 0 && (
              <div className="mt-4 border-t border-slate-700 pt-4 space-y-2">
                <button onClick={validateData} className="w-full py-2 bg-orange-600 hover:bg-orange-500 rounded text-sm font-bold shadow-md transition-colors">Run Validation</button>
                <button onClick={handleImport} disabled={importing} className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 rounded text-sm font-bold shadow-md disabled:opacity-50 transition-colors">
                   {importing ? "Importing..." : "Finalize & Import to LedgerLine"}
                </button>
              </div>
            )}
          </div>

          {(duplicates.length > 0) && (
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 shadow-xl">
              <h3 className="text-sm font-bold mb-3 flex items-center"><AlertTriangle size={16} className="text-amber-400 mr-2"/> Validation Warnings</h3>
              <ul className="text-xs text-amber-200/70 space-y-2 bg-amber-900/20 p-3 rounded max-h-40 overflow-y-auto">
                {duplicates.map((dup, i) => (
                  <li key={i}>• Duplicate item "{dup.name}" detected in row {dup.row}.</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        <div className="w-2/3 bg-slate-800 rounded-xl border border-slate-700 shadow-xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-700 bg-slate-900/50 flex justify-between items-center">
             <h3 className="font-bold flex items-center"><FileText size={18} className="mr-2 text-indigo-400"/> Mapping Interface</h3>
          </div>
          
          <div className="flex-1 p-6">
              {headers.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-50">
                  <UploadCloud size={48} className="mb-4 text-slate-500" />
                  <p>Upload a CSV file to start mapping columns.</p>
                </div>
              ) : (
                <div className="space-y-6 max-w-lg mx-auto bg-slate-900/50 p-6 rounded-xl border border-slate-700">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-bold text-slate-300 w-1/3">Target Field</span>
                    <span className="w-2/3 text-sm font-bold text-indigo-400">Source POS Column</span>
                  </div>
                  
                  {['name', 'price', 'category', 'costPrice'].map(field => (
                    <div key={field} className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">{field}</label>
                      <select 
                        value={(mapping as any)[field]}
                        onChange={(e) => setMapping({...mapping, [field]: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-700 rounded-md p-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                      >
                        <option value="">-- Select Source Column --</option>
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  ))}
                  
                  {csvData.length > 0 && mapping.name && (
                     <div className="mt-8 pt-6 border-t border-slate-700">
                        <p className="text-xs text-slate-500 mb-2 font-bold uppercase">Sample Preview (Row 1)</p>
                        <div className="bg-slate-950 p-4 rounded-lg font-mono text-xs text-slate-300 space-y-1">
                          <p><span className="text-indigo-400">Name:</span> {csvData[0][mapping.name]}</p>
                          {mapping.price && <p><span className="text-indigo-400">Price:</span> {csvData[0][mapping.price]}</p>}
                          {mapping.category && <p><span className="text-indigo-400">Category:</span> {csvData[0][mapping.category]}</p>}
                        </div>
                     </div>
                  )}
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
