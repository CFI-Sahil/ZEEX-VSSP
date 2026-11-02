import React from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Badge from '../common/Badge';
import { Video, MapPin, Calendar, Clock, Activity } from 'lucide-react';

export function CameraDetailModal({ isOpen, onClose, camera }) {
  if (!camera) return null;

  const statusVariant =
    camera.status === 'ONLINE'
      ? 'success'
      : camera.status === 'OFFLINE'
      ? 'danger'
      : 'warning';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Camera Details: ${camera.cameraCode}`}
      description="Inspect registered operational camera metadata and connection state."
      footer={
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-5">
        {/* Stream Availability Card */}
        <div className="rounded-xl border border-[var(--color-border)] bg-slate-900 text-white p-5 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 mb-2">
            <Video className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-semibold text-white">{camera.name}</h4>
          <p className="text-xs text-slate-400 mt-1">
            Admin Status: <span className="font-semibold text-slate-200">{camera.status}</span> · Stream Connectivity: <span className="font-semibold text-slate-200">{camera.streamStatus || 'UNAVAILABLE'}</span>
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Badge variant={statusVariant} size="sm" dot>
              Admin: {camera.status}
            </Badge>
            <Badge variant="neutral" size="sm">
              Stream: {camera.streamStatus || 'UNAVAILABLE'}
            </Badge>
          </div>
          <p className="text-[11px] text-slate-400 mt-2.5 max-w-sm">
            Honest stream state: No live RTSP/video integration is connected in this MVP.
          </p>
          <p className="text-[10px] text-slate-500 mt-1 italic">
            Administrative ONLINE status indicates manual registry provision, not an active video signal.
          </p>
        </div>

        {/* Detailed Metadata Grid */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
            <div className="flex items-center gap-1.5 text-slate-500 font-medium mb-1">
              <MapPin className="w-3.5 h-3.5" />
              <span>Location / Facility</span>
            </div>
            <p className="font-semibold text-slate-900">{camera.site}</p>
            <p className="text-slate-600 mt-0.5">{camera.location}</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
            <div className="flex items-center gap-1.5 text-slate-500 font-medium mb-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Last Heartbeat</span>
            </div>
            <p className="font-semibold text-slate-900">
              {camera.lastSeenAt ? new Date(camera.lastSeenAt).toLocaleString() : 'None (Unverified / Null)'}
            </p>
            <p className="text-slate-500 mt-0.5">Telemetry state</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
            <div className="flex items-center gap-1.5 text-slate-500 font-medium mb-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>Registered Date</span>
            </div>
            <p className="font-semibold text-slate-900">
              {camera.createdAt ? new Date(camera.createdAt).toLocaleDateString() : 'N/A'}
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
            <div className="flex items-center gap-1.5 text-slate-500 font-medium mb-1">
              <Activity className="w-3.5 h-3.5" />
              <span>Operational Mode</span>
            </div>
            <p className="font-semibold text-slate-900">20% Surveillance MVP</p>
          </div>
        </div>

        {/* Description / Notes */}
        {camera.description && (
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 text-xs">
            <span className="font-semibold text-slate-700 block mb-1">Operational Description:</span>
            <p className="text-slate-600 leading-relaxed">{camera.description}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default CameraDetailModal;

