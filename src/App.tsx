import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./wasm_exec";

import FileOrganizer from "./FileOrganizer";
import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
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
    <MantineProvider>
      <Notifications />
      <ModalsProvider>
        <FileOrganizer />
      </ModalsProvider>
    </MantineProvider>
  );
}

export default App;
