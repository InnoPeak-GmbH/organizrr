import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./wasm_exec";

import { MantineProvider, createTheme } from "@mantine/core";

import { MLEngineContextProvider } from "./MLEngineContext";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import Organizrr from "./Organizrr";
import { useEffect } from "react";

declare class Go {
  argv: string[];
  env: { [envKey: string]: string };
  exit: (code: number) => void;
  importObject: WebAssembly.Imports;
  exited: boolean;
  mem: DataView;
  run(instance: WebAssembly.Instance): Promise<void>;
}

const theme = createTheme({ primaryColor: "violet" });

function App() {
  useEffect(() => {
    const go = new Go();

    WebAssembly.instantiateStreaming(fetch("/main.wasm"), go.importObject).then(
      (result) => {
        go.run(result.instance);
      }
    );
  }, []);

  return (
    <MantineProvider theme={theme}>
      <Notifications />
      <ModalsProvider>
        <MLEngineContextProvider>
          <Organizrr />
        </MLEngineContextProvider>
      </ModalsProvider>
    </MantineProvider>
  );
}

export default App;
