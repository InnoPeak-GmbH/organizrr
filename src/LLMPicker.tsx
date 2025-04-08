import {
  ActionIcon,
  Drawer,
  Group,
  Indicator,
  Progress,
  Select,
  Stack,
  StackProps,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { IconCpu, IconRobotFace } from "@tabler/icons-react";

import { useDisclosure } from "@mantine/hooks";
import { useMLEngine } from "./MLEngineContext";

function LLMPicker(props: StackProps) {
  const [opened, { open, close }] = useDisclosure(false);

  const { loadingModel, activeModel, selectModel, modelList, gpuVendor } =
    useMLEngine();

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
        title={
          <Group>
            <IconRobotFace />
            <Title size="h3">LLM</Title>
          </Group>
        }
        position="bottom"
        size={200}
      >
        <Stack>
          <Select
            data={modelList}
            value={activeModel}
            onChange={(val) => val && selectModel(val)}
            searchable
            clearable
            hiddenFrom="sm"
          />
          {gpuVendor && (
            <Group>
              <IconCpu />
              <Text>{gpuVendor}</Text>
            </Group>
          )}
        </Stack>
      </Drawer>
    </Stack>
  );
}

export default LLMPicker;
