'use client';

import React, { use } from 'react';
import ClearanceCertificate from '@/components/student/ClearanceCertificate';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ClearancePrintPage({ params }: PageProps) {
  const resolvedParams = use(params);

  return <ClearanceCertificate applicationId={resolvedParams.id} />;
}
