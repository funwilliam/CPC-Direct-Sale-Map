import { useEffect, useState } from 'react';
import { FUEL_LABELS, type Fuels, type Station } from '../../types/station.ts';

interface Props {
  station: Station;
  onClose: () => void;
}

/** 底部資訊卡（spec/map.md §資訊卡）；地圖與清單共用 */
export default function StationCard({ station, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
  }, [station.id]);

  // Esc 關閉（桌面慣例）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(station.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard 不可用（非 https/舊瀏覽器）→ 退回選取提示
      window.prompt('手動複製地址：', station.address);
    }
  };

  const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}`;

  return (
    <div className="station-card" role="dialog" aria-label={station.name}>
      <button className="card-close" onClick={onClose} aria-label="關閉">
        ×
      </button>
      <div className="card-head">
        <h2>{station.name}</h2>
        {station.isDirect ? (
          <span className="badge badge-direct">直營</span>
        ) : (
          <span className="badge badge-franchise">加盟站</span>
        )}
        {!station.isOpen && <span className="badge badge-closed">暫停營業</span>}
      </div>
      {!station.isDirect && <p className="franchise-note">非直營站，注意避免誤闖</p>}
      <p className="card-address">
        {station.address}
        <button className="copy-btn" onClick={copyAddress}>
          {copied ? '✓ 已複製' : '複製'}
        </button>
      </p>
      <p className="card-hours">營業時間：{station.hours || '—'}</p>
      <div className="fuel-chips">
        {(Object.keys(FUEL_LABELS) as (keyof Fuels)[]).map((f) => (
          <span key={f} className={`chip ${station.fuels[f] ? 'chip-on' : 'chip-off'}`}>
            {FUEL_LABELS[f]}
          </span>
        ))}
      </div>
      <a className="nav-btn" href={navUrl} target="_blank" rel="noopener noreferrer">
        Google Maps 導航
      </a>
    </div>
  );
}
