import {
  Group,
  Indicator,
  Progress,
  Select,
  Stack,
  Tooltip,
} from "@mantine/core";

import { IconRobotFace } from "@tabler/icons-react";
import { useMLEngine } from "./MLEngineContext";

function LLMPicker() {
  const { loadingModel, activeModel, selectModel, modelList } = useMLEngine();

  return (
    <Stack>
      <Group>
        <Tooltip
          label={
            activeModel
              ? loadingModel
                ? `${activeModel} (KI Modell wird geladen)`
                : activeModel
              : "KI Modell wird geladen"
          }
        >
          <Indicator
            color={activeModel ? (loadingModel ? "" : "green") : "orange"}
            processing={loadingModel !== null}
          >
            <IconRobotFace />
          </Indicator>
        </Tooltip>
        {modelList && (
          <Select
            data={modelList}
            value={activeModel}
            onChange={(val) => val && selectModel(val)}
            searchable
            clearable
          />
        )}
      </Group>
      {loadingModel && (
        <Progress value={loadingModel.progress} striped animated />
      )}
    </Stack>
  );
}

export default LLMPicker;
