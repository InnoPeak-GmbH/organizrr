import {
  Autocomplete,
  Box,
  Button,
  Flex,
  Group,
  Pagination,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { Document, Page } from "react-pdf";
import { Dropzone, FileWithPath } from "@mantine/dropzone";
import { Form, isNotEmpty, useForm } from "@mantine/form";
import {
  IconCheck,
  IconExclamationMark,
  IconFile,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { useCallback, useState } from "react";

import { notifications } from "@mantine/notifications";

declare global {
  function createArchive(payload: string): Promise<string>;
}

type FormValues = {
  files: { file: FileWithPath; suffix: string; selectedPages: string[] }[];
  customer: { firstName: string; lastName: string };
};

function FileOrganizer() {
  const form = useForm<FormValues>({
    mode: "uncontrolled",
    initialValues: { files: [], customer: { firstName: "", lastName: "" } },
    validate: {
      customer: {
        firstName: isNotEmpty("Wert ist erforderlich"),
        lastName: isNotEmpty("Wert ist erforderlich"),
      },
      files: {
        suffix: isNotEmpty("Wert ist erforderlich"),
        selectedPages: (value) => (!value ? "Wert ist erforderlich" : null),
      },
    },
    validateInputOnBlur: true,
  });

  const [selectedFile, setSelectedFile] = useState<number | null>(null);
  const [numPages, setNumPages] = useState<number>();
  const [pageNumber, setPageNumber] = useState<number>(1);

  const onDocumentLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      setNumPages(numPages);
    },
    [setNumPages]
  );

  const handleSubmit = async (values: FormValues) => {
    const id = Math.random().toString(36).replace("0.", "notification_");

    notifications.show({
      id,
      title: "Dateien werden verarbeitet",
      message: "Dateien werden nun benennt und als ZIP gespeichert",
      autoClose: false,
      withCloseButton: false,
      loading: true,
    });

    const f = await Promise.all(
      values.files.map(async (f) => {
        const getDataURL = () => {
          const reader = new FileReader();

          const promise = new Promise<string>((res, rej) => {
            reader.onload = () => {
              res((reader.result as string)?.split(",")[1]);
            };

            reader.onerror = () => {
              rej();
            };
          });

          reader.readAsDataURL(f.file);

          return promise;
        };

        const dataURL = await getDataURL();

        return {
          ...f,
          name: f.file.name,
          blob: dataURL,
        };
      })
    );

    try {
      const resultArchive = await createArchive(
        JSON.stringify({
          customer: {
            firstName: values.customer.firstName,
            lastName: values.customer.lastName,
          },
          files: f,
        })
      );

      notifications.update({
        id,
        color: "teal",
        title: "Dateien wurden verarbeitet",
        message: `Dateien können nun heruntergeladen werden!`,
        icon: <IconCheck size={18} />,
        loading: false,
        autoClose: 2000,
      });

      const uri = `data:application/zip;base64,${resultArchive}`;

      const date = `${new Date().getFullYear()}-${new Date()
        .getMonth()
        .toString()
        .padStart(2, "0")}-${new Date()
        .getDate()
        .toString()
        .padStart(2, "0")}_${new Date()
        .getHours()
        .toString()
        .padStart(2, "0")}-${new Date()
        .getMinutes()
        .toString()
        .padStart(2, "0")}-${new Date()
        .getSeconds()
        .toString()
        .padStart(2, "0")}`;

      const link = document.createElement("a");
      link.download = `${date}_${values.customer.firstName}_${values.customer.lastName}`;
      link.href = uri;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error: unknown) {
      notifications.update({
        id,
        color: "red",
        title: "Ein Fehler ist passiert",
        message: error as string,
        icon: <IconExclamationMark size={18} />,
        loading: false,
        autoClose: 2000,
      });

      console.error(error);

      return;
    }
  };

  return (
    <Form form={form} onSubmit={handleSubmit}>
      <Stack p="md">
        <Title order={2}>Kunde</Title>
        <Group>
          <TextInput
            label="Vorname"
            placeholder="Vorname"
            withAsterisk
            required
            {...form.getInputProps("customer.firstName")}
          />
          <TextInput
            label="Nachname"
            placeholder="Nachname"
            withAsterisk
            required
            {...form.getInputProps("customer.lastName")}
          />
        </Group>
        <Flex direction="row-reverse" p="md">
          <Stack flex={2}>
            <Title order={2}>Dateien</Title>
            <Stack mah="50vh" style={{ overflow: "auto" }} p="md">
              {form.values.files.map((file, idx) => (
                <Stack>
                  <Group align="end" key={`${file.file.name}-${idx}`}>
                    <Button onClick={() => setSelectedFile(idx)} flex={1}>
                      {file.file.name}
                    </Button>
                    <Autocomplete
                      data={[
                        "Lohnausweis",
                        "Öffentlicher Verkehr",
                        "Steuererklärung",
                        "Weiterbildung",
                        "3A Bescheinigung",
                        "Steuerzugangsdaten",
                        "Wertschriften",
                        "Kontoauszug",
                        "Zinsauweis",
                        "Krankenkassenprämie",
                        "Krankenkassenrechnung",
                      ]}
                      label="Kategorie"
                      placeholder="Kategorie"
                      withAsterisk
                      required
                      {...form.getInputProps(`files.${idx}.suffix`)}
                    />
                  </Group>
                  <Group align="end">
                    <Text>Seiten auswählen:</Text>
                    {file.selectedPages.map((_, i) => (
                      <TextInput
                        label="Auswahl"
                        placeholder="Auswahl"
                        withAsterisk
                        required
                        {...form.getInputProps(
                          `files.${idx}.selectedPages.${i}`
                        )}
                      />
                    ))}
                    <Button
                      variant="light"
                      onClick={() =>
                        form.insertListItem(`files.${idx}.selectedPages`, "")
                      }
                    >
                      +
                    </Button>
                  </Group>
                </Stack>
              ))}
            </Stack>
            <Dropzone
              onDrop={(files) =>
                files.forEach((f) =>
                  form.insertListItem("files", {
                    file: f,
                    suffix: "",
                    selectedPages: [],
                  })
                )
              }
              accept={["application/pdf"]}
            >
              <Group
                justify="center"
                gap="xl"
                mih={120}
                style={{ pointerEvents: "none" }}
              >
                <Dropzone.Accept>
                  <IconUpload
                    size={52}
                    color="var(--mantine-color-blue-6)"
                    stroke={1.5}
                  />
                </Dropzone.Accept>
                <Dropzone.Reject>
                  <IconX
                    size={52}
                    color="var(--mantine-color-red-6)"
                    stroke={1.5}
                  />
                </Dropzone.Reject>
                <Dropzone.Idle>
                  <IconFile
                    size={52}
                    color="var(--mantine-color-dimmed)"
                    stroke={1.5}
                  />
                </Dropzone.Idle>

                <Box>
                  <Text size="xl" inline>
                    Drag files here or click to select
                  </Text>
                </Box>
              </Group>
            </Dropzone>
            <Button type="submit">Submit</Button>
          </Stack>
          <Flex flex={2} align="center" direction="column">
            {selectedFile && (
              <Stack>
                <Title order={2}>Vorschau</Title>
                <Document
                  file={form.values.files[selectedFile].file}
                  onLoadSuccess={onDocumentLoadSuccess}
                >
                  <Page pageNumber={pageNumber} />
                </Document>
              </Stack>
            )}
            <Pagination
              value={pageNumber}
              onChange={setPageNumber}
              total={numPages ?? 0}
            />
          </Flex>
        </Flex>
      </Stack>
    </Form>
  );
}

export default FileOrganizer;
