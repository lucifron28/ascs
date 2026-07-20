'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { fetchClearanceCertificateAction } from '@/app/actions/clearance';
import { Printer, Shield, ArrowLeft, CheckCircle2, AlertCircle, Award, FileCheck } from 'lucide-react';

interface ClearanceCertificateProps {
  applicationId: string;
}

export default function ClearanceCertificate({ applicationId }: ClearanceCertificateProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any | null>(null);

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    async function loadCertificate() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchClearanceCertificateAction(applicationId);
        if (isMounted.current) {
          if (res.success && res.certificateData) {
            setData(res.certificateData);
          } else {
            setError(res.error || 'Failed to load clearance certificate.');
          }
        }
      } catch (err: any) {
        if (isMounted.current) {
          setError(err.message || 'Connection error.');
        }
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    }
    loadCertificate();
    return () => {
      isMounted.current = false;
    };
  }, [applicationId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
        <span className="loading loading-spinner loading-lg text-primary mb-4" />
        <p className="text-sm font-medium text-base-content/70">Generating Official Clearance Certificate...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 max-w-xl mx-auto p-6 flex flex-col items-center justify-center text-center space-y-4">
        <div className="alert alert-error rounded-2xl shadow-lg flex flex-col items-center p-6 text-center">
          <AlertCircle className="w-10 h-10 mb-2" />
          <h2 className="font-bold text-base">Certificate Generation Error</h2>
          <p className="text-xs opacity-90">{error || 'Certificate data unavailable.'}</p>
        </div>
        <button onClick={() => router.back()} className="btn btn-sm btn-ghost rounded-xl gap-2">
          <ArrowLeft className="w-4 h-4" /> Go Back
        </button>
      </div>
    );
  }

  const { application, approvals, issuedAt } = data;

  return (
    <div className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
      {/* Print Control Toolbar (Hidden on Print) */}
      <div className="print:hidden flex items-center justify-between bg-base-100 p-4 rounded-2xl border border-base-content/10 shadow-md">
        <button onClick={() => router.back()} className="btn btn-sm btn-ghost rounded-xl gap-2">
          <ArrowLeft className="w-4 h-4" /> Return to Dashboard
        </button>
        <button onClick={handlePrint} className="btn btn-primary btn-sm rounded-xl gap-2 font-semibold shadow-sm">
          <Printer className="w-4 h-4" /> Print / Save PDF
        </button>
      </div>

      {/* Official Certificate Paper Container */}
      <div className="bg-white text-slate-900 border-8 border-double border-indigo-900 p-8 sm:p-12 rounded-none shadow-2xl space-y-8 font-serif print:border-4 print:p-8 print:shadow-none print:m-0 print:w-full">
        {/* Header / Seal */}
        <div className="text-center space-y-2 border-b-2 border-slate-300 pb-6">
          <div className="flex items-center justify-center gap-2 text-indigo-900 font-sans">
            <Shield className="w-8 h-8 text-indigo-900 shrink-0" />
            <span className="font-black text-xl tracking-widest uppercase">Pamantasan ng Lungsod ng Maynila</span>
          </div>
          <p className="text-xs tracking-wider uppercase font-sans text-slate-600 font-semibold">
            Office of the University Registrar & Student Affairs
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 pt-2 font-serif uppercase">
            Official Student Clearance Certificate
          </h1>
          <p className="text-xs font-mono text-slate-500 font-semibold">
            Reference No: <span className="text-indigo-950 font-bold">{application.applicationNumber}</span>
          </p>
        </div>

        {/* Certificate Preamble */}
        <div className="text-center text-sm sm:text-base leading-relaxed space-y-3 font-serif">
          <p>This is to certify that the student specified below has complied with and completed all academic, departmental, library, financial, and administrative clearance requirements for the designated term.</p>
        </div>

        {/* Student Profile Grid */}
        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs font-sans">
          <div>
            <span className="text-slate-500 uppercase font-semibold text-[10px] block">Student Full Name</span>
            <span className="font-bold text-sm text-slate-900">{application.studentName}</span>
          </div>
          <div>
            <span className="text-slate-500 uppercase font-semibold text-[10px] block">Student Number</span>
            <span className="font-bold text-sm font-mono text-slate-900">{application.studentNumber}</span>
          </div>
          <div>
            <span className="text-slate-500 uppercase font-semibold text-[10px] block">Program & Year Level</span>
            <span className="font-semibold text-slate-800">{application.program} - {application.yearLevel} (Section {application.section})</span>
          </div>
          <div>
            <span className="text-slate-500 uppercase font-semibold text-[10px] block">Academic Term & Purpose</span>
            <span className="font-semibold text-slate-800">AY {application.academicYear} | {application.semester} Sem ({application.purpose})</span>
          </div>
        </div>

        {/* Clearance Verification Matrix */}
        <div className="space-y-3 font-sans">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1 flex items-center gap-1.5">
            <FileCheck className="w-4 h-4 text-indigo-900" /> Department Clearance Sign-off Matrix
          </h3>

          <table className="w-full text-left text-xs border border-slate-200">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                <th className="p-2 border-r border-slate-200">Department / Office</th>
                <th className="p-2 border-r border-slate-200">Assigned Evaluator</th>
                <th className="p-2 border-r border-slate-200">Date Verified</th>
                <th className="p-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {approvals.map((app: any) => (
                <tr key={app.id}>
                  <td className="p-2 font-semibold border-r border-slate-200">{app.label}</td>
                  <td className="p-2 border-r border-slate-200 text-slate-700">{app.assignedSignatoryName}</td>
                  <td className="p-2 border-r border-slate-200 font-mono text-[11px] text-slate-600">
                    {app.actedAt ? new Date(app.actedAt).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="p-2 text-center font-bold text-emerald-700 uppercase text-[10px]">
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Cleared
                    </span>
                  </td>
                </tr>
              ))}
              {/* Financial Accountability Row */}
              <tr>
                <td className="p-2 font-semibold border-r border-slate-200">Accountant Financial Audit</td>
                <td className="p-2 border-r border-slate-200 text-slate-700">
                  {application.financialUpdatedByName || 'University Accountant'}
                </td>
                <td className="p-2 border-r border-slate-200 font-mono text-[11px] text-slate-600">
                  {application.financialVerifiedAt
                    ? new Date(application.financialVerifiedAt).toLocaleDateString()
                    : 'N/A'}
                </td>
                <td className="p-2 text-center font-bold text-emerald-700 uppercase text-[10px]">
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> {application.financialStatus.toUpperCase()}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Official Dean Sign-off & Seal */}
        <div className="pt-8 grid grid-cols-2 gap-8 items-end font-sans">
          <div className="space-y-2">
            <div className="w-24 h-24 border-2 border-dashed border-slate-300 rounded-full flex items-center justify-center text-[10px] text-slate-400 font-bold uppercase text-center p-2">
              Official University Seal
            </div>
            <p className="text-[10px] text-slate-500">
              Date Issued: <span className="font-mono font-semibold text-slate-700">{new Date(issuedAt).toLocaleDateString()}</span>
            </p>
          </div>

          <div className="text-center space-y-1">
            <div className="border-b border-slate-900 pb-1 font-bold text-sm uppercase text-slate-900">
              Office of the Academic Dean
            </div>
            <p className="text-xs text-slate-600 font-serif">College Academic Dean & Registrar</p>
            <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider flex items-center justify-center gap-1">
              <Award className="w-3 h-3" /> Final Academic Approval Validated
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
