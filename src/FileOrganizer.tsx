import {
  Autocomplete,
  Box,
  Button,
  Flex,
  Group,
  Indicator,
  Pagination,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import {
  ChatCompletionMessageParam,
  CreateMLCEngine,
  InitProgressCallback,
  MLCEngine,
  prebuiltAppConfig,
} from "@mlc-ai/web-llm";
import { Document, Page } from "react-pdf";
import { Dropzone, FileWithPath } from "@mantine/dropzone";
import { Form, isNotEmpty, useForm } from "@mantine/form";
import {
  IconCheck,
  IconExclamationMark,
  IconFile,
  IconRobotFace,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { notifications } from "@mantine/notifications";
import { useLocalStorage } from "@mantine/hooks";

declare global {
  function createArchive(payload: string): Promise<string>;
}

type FormValues = {
  files: { file: FileWithPath; suffix: string; selectedPages: string[] }[];
  customer: { firstName: string; lastName: string };
};

const fileCategories = [
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
];

const systemMessage = {
  role: "system",
  content: `
You are an AI assistant for a financial advisor. You will help them label files based on the file name using the following categories: ${fileCategories.join(
    ", "
  )}

The user will provide the file name. Make the best assumption based on common financial document names. Respond ONLY with the label or "Unable to label file" - nothing else.
`,
} satisfies ChatCompletionMessageParam;

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

  const engine = useRef<MLCEngine>(null);
  const [loadingModel, setLoadingModel] = useState<string | null>(null);
  const [runningModel, setRunningModel] = useState<string | null>(null);

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
          if (
            initProgress.progress === 1 &&
            initProgress.text.startsWith("Finish loading")
          ) {
            setRunningModel(selectedModel);
            setLoadingModel(null);
          }
        };

        engine.current = await CreateMLCEngine(
          selectedModel,
          { initProgressCallback: initProgressCallback } // engineConfig
        );
      })();
    }
  }, [
    engine,
    selectedModel,
    runningModel,
    setRunningModel,
    setLoadingModel,
  ]);

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

  const handleFilesDrop = async (files: FileWithPath[]) => {
    files.forEach((f) =>
      form.insertListItem("files", {
        file: f,
        suffix: "",
        selectedPages: [],
      })
    );

    await Promise.all(
      files.map(async (file) => {
        const messages: ChatCompletionMessageParam[] = [
          systemMessage,
          { role: "user", content: "The file name is: " + file.name },
        ];

        const reply = await engine.current?.chat.completions.create({
          messages,
        });

        if (
          reply &&
          reply.choices[0].message.content &&
          !reply?.choices[0].message.content?.includes(
            "Unable to label file"
          ) &&
          !reply?.choices[0].message.content?.includes("I'm sorry")
        ) {
          console.log(reply?.choices[0].message.content);
          form.getValues().files.forEach((f, idx) => {
            if (f.file.name === file.name) {
              form.setFieldValue(
                `files.${idx}.suffix`,
                reply?.choices[0].message.content?.split("\n")[0]
              );
            }
          });
        }
      })
    );
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
            key={form.key("customer.firstName")}
          />
          <TextInput
            label="Nachname"
            placeholder="Nachname"
            withAsterisk
            required
            {...form.getInputProps("customer.lastName")}
            key={form.key("customer.lastName")}
          />
          <Group ml="auto">
            <Tooltip
              label={
                runningModel
                  ? loadingModel
                    ? `${runningModel} (KI Modell wird geladen)`
                    : runningModel
                  : "KI Modell wird geladen"
              }
            >
              <Indicator
                color={
                  runningModel ? (loadingModel ? "blue" : "green") : "orange"
                }
                processing={loadingModel !== null}
              >
                <IconRobotFace />
              </Indicator>
            </Tooltip>
            {modelList && (
              <Select
                data={modelList}
                value={selectedModel}
                onChange={(val) => val && setSelectedModel(val)}
              />
            )}
          </Group>
        </Group>
        <Flex direction="row-reverse" p="md">
          <Stack flex={2}>
            <Title order={2}>Dateien</Title>
            <Stack mah="50vh" style={{ overflow: "auto" }} p="md">
              {form.values.files.map((file, idx) => (
                <Stack key={`${file.file.name}-${idx}`}>
                  <Group align="end">
                    <Button onClick={() => setSelectedFile(idx)} flex={1}>
                      {file.file.name}
                    </Button>
                    <Autocomplete
                      data={fileCategories}
                      label="Kategorie"
                      placeholder="Kategorie"
                      withAsterisk
                      required
                      {...form.getInputProps(`files.${idx}.suffix`)}
                      key={form.key(`files.${idx}.suffix`)}
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
                        key={form.key(`files.${idx}.selectedPages.${i}`)}
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
            <Dropzone onDrop={handleFilesDrop} accept={["application/pdf"]}>
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
            {selectedFile != null && (
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
