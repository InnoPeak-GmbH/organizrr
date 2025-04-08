import {
  CreateMLCEngine,
  InitProgressCallback,
  MLCEngine,
  prebuiltAppConfig,
} from "@mlc-ai/web-llm";
import {
  ReactNode,
  RefObject,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { useLocalStorage } from "@mantine/hooks";

const models = [
  "TinyLlama-1.1B-Chat-v0.4-q4f32_1-MLC",
  "phi-1_5-q4f16_1-MLC",
  "gemma-2-2b-it-q4f16_1-MLC-1k",
  "gemma-2-2b-it-q4f32_1-MLC-1k",
  "phi-2-q4f16_1-MLC-1k",
  "Qwen2.5-3B-Instruct-q4f16_1-MLC",
  "Phi-3-mini-4k-instruct-q4f16_1-MLC-1k",
  "Phi-3.5-mini-instruct-q4f32_1-MLC-1k",
  "Llama-3.1-8B-Instruct-q4f16_1-MLC-1k",
];

const modelList = [
  {
    group: "Primär",
    items: prebuiltAppConfig.model_list
      .filter((m) => models.includes(m.model_id))
      .map((m) => ({
        ...m,
        value: m.model_id,
        label: m.model_id,
      })),
  },
  {
    group: "Andere",
    items: prebuiltAppConfig.model_list
      .filter((m) => !models.includes(m.model_id))
      .map((m) => ({
        ...m,
        value: m.model_id,
        label: m.model_id,
      })),
  },
];

type MLEngineContext = {
  activeModel: string | null;
  selectedModel: string | null;
  gpuVendor: string | null;
  loadingModel: {
    name: string;
    progress: number;
  } | null;
  engine: RefObject<MLCEngine | null>;
  selectModel: (name: string) => void;
  modelList: {
    group: string;
    items: any;
  }[];
};

const MLEngineContext = createContext<MLEngineContext>({
  activeModel: null,
  selectedModel: null,
  gpuVendor: null,
  loadingModel: null,
  engine: { current: null },
  selectModel: () => {},
  modelList,
});

export function MLEngineContextProvider({ children }: { children: ReactNode }) {
  const engine = useRef<MLCEngine>(null);

  const [loadingModel, setLoadingModel] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<number | null>(null);
  const [runningModel, setRunningModel] = useState<string | null>(null);
  const [gpuVendor, setGpuVendor] = useState<string | null>(null);

  const [selectedModel, setSelectedModel] = useLocalStorage<string | null>({
    key: "modelId",
    defaultValue: null,
  });

  useEffect(() => {
    if (selectedModel && runningModel !== selectedModel) {
      (async () => {
        setLoadingModel(selectedModel);
        const initProgressCallback: InitProgressCallback = async (
          initProgress
        ) => {
          setLoadingProgress(initProgress.progress);
        };

        engine.current = await CreateMLCEngine(selectedModel, {
          initProgressCallback: initProgressCallback,
        });

        setRunningModel(selectedModel);
        setLoadingModel(null);
        setLoadingProgress(null);

        const gpuVendor = await engine.current?.getGPUVendor();
        if (gpuVendor) {
          setGpuVendor(gpuVendor);
        }
      })();
    }
  }, [
    engine,
    selectedModel,
    runningModel,
    setRunningModel,
    setLoadingModel,
    setLoadingProgress,
    setGpuVendor,
  ]);

  return (
    <MLEngineContext.Provider
      value={{
        engine,
        loadingModel:
          loadingModel && loadingProgress !== null
            ? { name: loadingModel, progress: loadingProgress }
            : null,
        activeModel: runningModel,
        selectedModel,
        gpuVendor,
        selectModel: setSelectedModel,
        modelList,
      }}
    >
      {children}
    </MLEngineContext.Provider>
  );
}

export const useMLEngine = () => useContext(MLEngineContext);
