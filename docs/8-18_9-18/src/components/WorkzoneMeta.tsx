import { useStore } from '@/store';
import { workzones } from '@/utils';

export default function WorkzoneMeta() {
  const workzoneId = useStore((state) => state.workzoneId);
  const workzone = workzones.find((w) => w.workzone_id === workzoneId);

  if (!workzone) {
    return (
      <div className='rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800'>
        Workzone not found
      </div>
    );
  }

  return (
    <div className='rounded-lg border border-slate-200 bg-slate-50 px-4 py-3'>
      <div className='flex flex-wrap items-center gap-x-6 gap-y-2 text-sm'>
        <div className='flex items-center gap-2'>
          <span className='font-mono font-semibold text-slate-900'>
            {workzone.workzone_id}
          </span>
          {workzone.is_chins_reportable ? (
            <span className='rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700'>
              CHINS
            </span>
          ) : (
            <span className='rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700'>
              Not CHINS
            </span>
          )}
        </div>

        <div className='flex items-center gap-1.5 text-slate-600'>
          <span className='text-slate-400'>District</span>
          <span className='font-medium text-slate-800'>
            {workzone.district}
          </span>
        </div>

        <div className='flex items-center gap-1.5 text-slate-600'>
          <span className='text-slate-400'>Cause</span>
          <span className='font-medium text-slate-800'>{workzone.cause}</span>
        </div>

        <div className='flex items-center gap-3 text-slate-600'>
          <span>
            <span className='text-slate-400'># Test: </span>
            <span className='font-medium text-slate-800'>
              {workzone.test_n.toLocaleString()}
            </span>
          </span>
          <span>
            <span className='text-slate-400'># Control: </span>
            <span className='font-medium text-slate-800'>
              {workzone.control_n.toLocaleString()}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
