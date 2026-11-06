import React from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Badge from '../common/Badge';
import {
  Image as ImageIcon,
  Camera,
  AlertTriangle,
  Clock,
  HardDrive,
  Download,
} from 'lucide-react';
import evidenceService from '../../services/evidenceService';

export function EvidenceDetailModal({ isOpen, onClose, evidence = null }) {
  if (!evidence) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Evidence Snapshot: ${evidence.evidenceCode}`}
      description="Cryptographically preserved snapshot image associated with a detected safety event."
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
          <a
            href={evidenceService.getEvidenceFileUrl(evidence._id)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm" icon={Download}>
              Open Original
            </Button>
          </a>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Image Preview Container */}
        <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-950 flex flex-col items-center justify-center min-h-64">
          <img
            src={evidenceService.getEvidenceFileUrl(evidence._id)}
            alt={`Snapshot ${evidence.evidenceCode}`}
            className="max-h-80 w-full object-contain"
            crossOrigin="use-credentials"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
          <div className="p-6 hidden flex-col items-center justify-center text-center text-slate-400">
            <ImageIcon className="w-10 h-10 text-slate-600 mb-2" />
            <p className="text-xs font-medium">Image Not Available</p>
          </div>
        </div>

        {/* Metadata Details Grid */}
        <div className="grid grid-cols-1 xs:grid-cols-2 gap-2.5 sm:gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center gap-1.5 text-slate-500 font-medium mb-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Associated Alert</span>
            </div>
            <p className="font-semibold text-slate-900 font-mono">
              {evidence.alertCode || evidence.alert?.alertCode || 'N/A'}
            </p>
            <p className="text-slate-500 truncate">{evidence.alert?.violationName || 'Safety Incident'}</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center gap-1.5 text-slate-500 font-medium mb-1">
              <Camera className="w-3.5 h-3.5" />
              <span>Camera Point</span>
            </div>
            <p className="font-semibold text-slate-900">{evidence.cameraCode}</p>
            <p className="text-slate-500 truncate">{evidence.camera?.site || 'Plant 1'}</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center gap-1.5 text-slate-500 font-medium mb-1">
              <HardDrive className="w-3.5 h-3.5" />
              <span>File Details</span>
            </div>
            <p className="font-semibold text-slate-900 truncate">{evidence.fileName}</p>
            <p className="text-slate-500">
              {evidence.fileType} · {(evidence.fileSize / 1024).toFixed(1)} KB
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center gap-1.5 text-slate-500 font-medium mb-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Captured At</span>
            </div>
            <p className="font-semibold text-slate-900 truncate">
              {evidence.capturedAt ? new Date(evidence.capturedAt).toLocaleString() : 'N/A'}
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default EvidenceDetailModal;

