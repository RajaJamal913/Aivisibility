import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, PlayCircle, XCircle } from 'lucide-react';
import type { PipelineStage } from '../../hooks/usePipeline';
import { Button, Spinner } from '../ui/Button';

interface PipelineStatusProps {
  stage: PipelineStage;
  stageMessage: string;
  elapsedSeconds: number;
  isRunning: boolean;
  onTrigger: () => void;
  errorMessage?: string;
}

export function PipelineStatus({
  stage,
  stageMessage,
  elapsedSeconds,
  isRunning,
  onTrigger,
  errorMessage,
}: PipelineStatusProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={stage === 'idle' ? 'idle' : isRunning ? 'running' : stage}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
          >
            {stage === 'done' && <CheckCircle2 size={20} className="text-positive-500" />}
            {stage === 'error' && <XCircle size={20} className="text-danger-500" />}
            {isRunning && <Spinner size={18} className="text-signal-500" />}
          </motion.span>
        </AnimatePresence>
        <div>
          <AnimatePresence mode="wait" initial={false}>
            {stage === 'idle' && (
              <motion.p
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm text-muted dark:text-muted-dark"
              >
                Run the pipeline to discover queries, score visibility, and generate recommendations.
              </motion.p>
            )}
            {isRunning && (
              <motion.p
                key={stage}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="text-sm font-medium text-ink dark:text-ink-dark"
              >
                {stageMessage} <span className="font-mono text-muted dark:text-muted-dark">({elapsedSeconds}s)</span>
              </motion.p>
            )}
            {stage === 'done' && (
              <motion.p
                key="done"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm font-medium text-positive-600 dark:text-positive-400"
              >
                Pipeline complete
              </motion.p>
            )}
            {stage === 'error' && (
              <motion.p
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm font-medium text-danger-600 dark:text-danger-500"
              >
                {errorMessage || 'The pipeline failed to complete.'}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
      <Button onClick={onTrigger} isLoading={isRunning} icon={<PlayCircle size={16} />}>
        {stage === 'idle' ? 'Run Pipeline' : 'Run Again'}
      </Button>
    </div>
  );
}
