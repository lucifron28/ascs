'use client';

import { normalizeSemester } from '@/lib/academic-term';
import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { fetchClearanceCertificateAction } from '@/app/actions/clearance';
import { Printer, ArrowLeft, CheckCircle2, AlertCircle, FileCheck } from 'lucide-react';
import { formatProgramNameFirst } from '@/lib/academic-programs';
import {
  CLEARANCE_WORKFLOW_STAGES,
  getWorkflowStageStatus,
  type WorkflowState,
} from '@/lib/clearance/workflow';

interface ClearanceCertificateProps {
  applicationId: string;
}

export default function ClearanceCertificate({ applicationId }: ClearanceCertificateProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Record<string, unknown> | null>(null);

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
            setError(res.error || 'Failed to load clearance record.');
          }
        }
      } catch (err: unknown) {
        if (isMounted.current) {
          const message = err instanceof Error ? err.message : 'Connection error.';
          setError(message);
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
        <span className="loading loading-spinner loading-lg text-primary mb-4" aria-hidden="true" />
        <p className="text-sm font-medium text-base-content/70">Preparing the ASCS clearance record...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 max-w-xl mx-auto p-6 flex flex-col items-center justify-center text-center space-y-4">
        <div className="alert alert-error rounded-xl shadow-sm flex flex-col items-center p-6 text-center">
          <AlertCircle className="w-10 h-10 mb-2" aria-hidden="true" />
          <h2 className="font-bold text-base">Clearance Record Unavailable</h2>
          <p className="text-xs opacity-90">{error || 'Clearance data unavailable.'}</p>
        </div>
        <button onClick={() => router.back()} className="btn btn-sm btn-ghost rounded-xl gap-2">
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Go Back
        </button>
      </div>
    );
  }

  const { application, approvals, issuedAt } = data as unknown as {
    application: {
      applicationNumber: string;
      studentName: string;
      studentNumber: string;
      program: string;
      yearLevel: string;
      section: string;
      academicYear: string;
      semester: string;
      purpose: string;
      financialUpdatedByName?: string;
      financialVerifiedAt?: string;
      financialRemarks?: string | null;
      financialStatus: string;
    };
    approvals: Array<{
      id: string;
      signatoryRole?: string;
      label: string;
      status: string;
      assignedSignatoryName?: string;
      remarksLatest?: string | null;
      actedAt?: string | null;
    }>;
    issuedAt: string;
  };

  const workflowState: WorkflowState = {
    approvals: approvals.map((approval) => ({
      signatoryRole: approval.signatoryRole,
      status: approval.status,
    })),
    financialStatus: application.financialStatus,
  };
  const workflowRows = CLEARANCE_WORKFLOW_STAGES.map((stage) => {
    const approval = stage.kind === 'approval'
      ? approvals.find((item) => item.signatoryRole === stage.role)
      : undefined;
    return {
      stage,
      status: getWorkflowStageStatus(stage, workflowState),
      approval,
    };
  });

  const normalizedSemester = normalizeSemester(application.semester);
  const displaySemester = normalizedSemester === '1st Semester'
    ? 'FIRST SEMESTER'
    : normalizedSemester === '2nd Semester'
      ? 'SECOND SEMESTER'
      : 'SUMMER SEMESTER';

  return (
    <div className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
      {/* Print Control Toolbar (Hidden on Print) */}
      <div className="print:hidden flex items-center justify-between bg-base-100 p-4 rounded-xl border border-base-content/15 shadow-sm">
        <button onClick={() => router.back()} className="btn btn-sm btn-ghost rounded-xl gap-2">
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Return to Dashboard
        </button>
        <button onClick={handlePrint} className="btn btn-primary btn-sm rounded-xl gap-2 font-semibold shadow-sm">
          <Printer className="w-4 h-4" aria-hidden="true" /> Print / Save PDF
        </button>
      </div>

      {/* A4-oriented digital prototype record */}
      <article
        id="printable-clearance-area"
        data-testid="printable-clearance-area"
        className="print-document bg-white text-slate-900 border border-slate-300 p-6 sm:p-10 rounded-none shadow-2xl space-y-6 font-serif print:border print:p-8 print:shadow-none print:m-0 print:w-full"
      >
        <header className="text-center space-y-2 border-b-2 border-slate-900 pb-5">
          <div className="flex items-center justify-center gap-2 text-indigo-950 font-sans">
            <Image
              src="/pkmlogo.png"
              alt="Pambayang Kolehiyo ng Mauban seal"
              width={56}
              height={56}
              className="h-10 w-10 shrink-0 object-contain"
            />
            <span className="font-black text-lg tracking-[0.18em] uppercase">Pambayang Kolehiyo ng Mauban</span>
          </div>
          <p className="text-[11px] tracking-[0.16em] uppercase font-sans text-slate-600 font-semibold">
            Automated Student Clearance System (ASCS)
          </p>
          <h1 className="text-2xl sm:text-3xl font-black tracking-[0.12em] text-slate-950 pt-2 uppercase">
            STUDENT CLEARANCE RECORD
          </h1>
          <p className="text-xs font-bold tracking-[0.2em] text-indigo-900 uppercase">PROTOTYPE / MVP</p>
          <p className="text-xs font-semibold text-slate-600 font-sans">
            <span className="text-slate-950">{`A.Y. ${application.academicYear} — ${displaySemester}`}</span>
          </p>
        </header>

        <section aria-labelledby="student-identity-heading" className="font-sans">
          <h2 id="student-identity-heading" className="text-xs font-black tracking-[0.16em] uppercase text-slate-700 border-b border-slate-300 pb-1">
            Student Identity and Clearance Details
          </h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 bg-slate-50 border border-slate-200 p-4 mt-3 text-xs">
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Student Name</dt>
              <dd className="font-bold text-sm text-slate-950">{application.studentName}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Student No.</dt>
              <dd className="font-bold text-sm font-mono text-slate-950">{application.studentNumber}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Program</dt>
              <dd className="font-semibold text-slate-800">{formatProgramNameFirst(application.program)}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Year / Section</dt>
              <dd className="font-semibold text-slate-800">{application.yearLevel} / {application.section}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Purpose</dt>
              <dd className="font-semibold text-slate-800">{application.purpose}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Clearance No.</dt>
              <dd className="font-semibold font-mono text-slate-800">{application.applicationNumber}</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="signatory-heading" data-testid="required-signatory-section" className="space-y-3 font-sans">
          <h2 id="signatory-heading" className="text-xs font-black tracking-[0.16em] uppercase text-slate-700 border-b border-slate-300 pb-1 flex items-center gap-1.5">
            <FileCheck className="w-4 h-4 text-indigo-900" aria-hidden="true" /> Six-Stage Clearance Workflow
          </h2>
          <table aria-label="Six-stage clearance workflow" data-testid="required-signatory-table" className="w-full text-left text-xs border border-slate-300">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-800">
                <th scope="col" className="p-2.5 border-r border-slate-300 font-black uppercase tracking-wide">Stage / Office</th>
                <th scope="col" className="p-2.5 border-r border-slate-300 font-black uppercase tracking-wide">Type</th>
                <th scope="col" className="p-2.5 border-r border-slate-300 font-black uppercase tracking-wide">Status</th>
                <th scope="col" className="p-2.5 border-r border-slate-300 font-black uppercase tracking-wide">Assigned Signatory</th>
                <th scope="col" className="p-2.5 border-r border-slate-300 font-black uppercase tracking-wide">Remarks</th>
                <th scope="col" className="p-2.5 font-black uppercase tracking-wide">Date Reviewed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {workflowRows.map(({ stage, status, approval }) => (
                <tr key={stage.key}>
                  <td className="p-2.5 border-r border-slate-200 font-bold uppercase text-[10px]">
                    <span className="font-bold text-slate-900">Step {stage.stage}: {stage.label}</span>
                  </td>
                  <td className="p-2.5 border-r border-slate-200 text-[10px] text-slate-700">
                    {stage.kind === 'financial' ? 'Financial gate' : 'Signatory approval'}
                  </td>
                  <td className="p-2.5 border-r border-slate-200 font-bold uppercase text-[10px]">
                    {stage.kind === 'financial' ? (
                      status === 'locked' ? (
                        <span className="text-slate-500">Locked</span>
                      ) : status === 'completed' || application.financialStatus === 'paid' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="w-3 h-3" aria-hidden="true" /> Paid / Financially Cleared</span>
                      ) : status === 'failed' || application.financialStatus === 'unpaid' ? (
                        <span className="inline-flex items-center gap-1 text-red-700"><AlertCircle className="w-3 h-3" aria-hidden="true" /> Unpaid / Hold</span>
                      ) : (
                        <span className="text-amber-700">Pending Financial Review</span>
                      )
                    ) : status === 'completed' ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="w-3 h-3" aria-hidden="true" /> Approved</span>
                    ) : status === 'failed' ? (
                      <span className="inline-flex items-center gap-1 text-red-700"><AlertCircle className="w-3 h-3" aria-hidden="true" /> Not Approved</span>
                    ) : status === 'locked' ? (
                      <span className="text-slate-500">Locked</span>
                    ) : (
                      <span className="text-amber-700">Pending</span>
                    )}
                  </td>
                  <td className="p-2.5 border-r border-slate-200 text-[11px] text-slate-700">
                    {stage.kind === 'financial' ? (
                      <div>
                        <span>{application.financialUpdatedByName || 'Financial Office'}</span>
                        <span className="block text-[9px] text-slate-500 font-normal">Financial status review</span>
                      </div>
                    ) : (
                      approval?.assignedSignatoryName || 'Department desk'
                    )}
                  </td>
                  <td className="p-2.5 border-r border-slate-200 text-[11px] text-slate-700 break-words">
                    {status === 'locked' ? 'Waiting for previous clearance step.' : stage.kind === 'financial' ? application.financialRemarks || 'No remarks recorded.' : approval?.remarksLatest || 'No remarks recorded.'}
                  </td>
                  <td className="p-2.5 font-mono text-[11px] text-slate-600">
                    {(stage.kind === 'financial' ? application.financialVerifiedAt : approval?.actedAt) ? new Date((stage.kind === 'financial' ? application.financialVerifiedAt : approval?.actedAt) as string).toLocaleDateString() : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text-slate-600">Accountant Clearance is Step 2 of 6 and is represented by financial status, not an approval document or signature. Decisions are recorded in ASCS; this prototype does not reproduce handwritten or electronic signatures.</p>
        </section>

        <footer className="flex items-end justify-between gap-6 border-t border-slate-300 pt-4 font-sans">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-700">Date Issued</p>
            <p className="font-mono text-xs text-slate-900">{new Date(issuedAt).toLocaleDateString()}</p>
          </div>
          <p className="max-w-lg text-right text-[11px] leading-4 text-slate-700">
            Prototype record generated by the ASCS capstone MVP for demonstration and evaluation purposes. This document is not an official institutional clearance certificate, receipt, or electronic signature.
          </p>
        </footer>
      </article>
    </div>
  );
}
