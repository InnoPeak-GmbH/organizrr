import { Box, Group, Text } from "@mantine/core";
import { DropzoneProps, Dropzone as MantineDropzone } from "@mantine/dropzone";
import { IconFiles, IconUpload, IconX } from "@tabler/icons-react";

function Dropzone(props: DropzoneProps) {
  return (
    <MantineDropzone {...props}>
      <Group
        justify="center"
        gap="xl"
        mih={130}
        style={{ pointerEvents: "none" }}
      >
        <MantineDropzone.Accept>
          <IconUpload
            size={52}
            color="var(--mantine-primary-color-6)"
            stroke={1.5}
          />
        </MantineDropzone.Accept>
        <MantineDropzone.Reject>
          <IconX size={52} color="var(--mantine-color-red-6)" stroke={1.5} />
        </MantineDropzone.Reject>
        <MantineDropzone.Idle>
          <IconFiles
            size={52}
            color="var(--mantine-color-dimmed)"
            stroke={1.5}
          />
        </MantineDropzone.Idle>

        <Box>
          <Text size="md" inline>
            Drag files here or click to select
          </Text>
        </Box>
      </Group>
    </MantineDropzone>
  );
}

export default Dropzone;
