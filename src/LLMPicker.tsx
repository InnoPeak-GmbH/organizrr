import {
  ActionIcon,
  Drawer,
  Group,
  Indicator,
  Progress,
  Select,
  Stack,
  StackProps,
  Tooltip,
} from "@mantine/core";

import { IconRobotFace } from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import { useMLEngine } from "./MLEngineContext";

function LLMPicker(props: StackProps) {
  const [opened, { open, close }] = useDisclosure(false);

  const { loadingModel, activeModel, selectModel, modelList } = useMLEngine();

  return (
    <Stack {...props}>
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
            <ActionIcon variant="subtle" onClick={open}>
              <IconRobotFace />
            </ActionIcon>
          </Indicator>
        </Tooltip>
        {modelList && (
          <Select
            data={modelList}
            value={activeModel}
            onChange={(val) => val && selectModel(val)}
            placeholder="Select a model..."
            searchable
            clearable
            visibleFrom="sm"
          />
        )}
      </Group>
      {loadingModel && (
        <Progress value={loadingModel.progress} striped animated />
      )}

      <Drawer
        offset={8}
        radius="md"
        opened={opened}
        onClose={close}
        title="Select model"
        position="bottom"
        size={200}
      >
        <Select
          data={modelList}
          value={activeModel}
          onChange={(val) => val && selectModel(val)}
          searchable
          clearable
        />
      </Drawer>
    </Stack>
  );
}

export default LLMPicker;
