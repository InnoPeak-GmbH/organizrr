import {
  Autocomplete,
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
import { Form, isNotEmpty, useForm } from "@mantine/form";
import {
  createArchiveAndDownload,
  fileCategories,
  systemMessage,
} from "./utils";
import { useCallback, useState } from "react";

import { ChatCompletionMessageParam } from "@mlc-ai/web-llm";
import type { CreateArchiveInput } from "./global.d";
import Dropzone from "./Dropzone";
import { FileWithPath } from "@mantine/dropzone";
import LLMPicker from "./LLMPicker";
import { useMLEngine } from "./MLEngineContext";

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

  const { engine } = useMLEngine();

  const [selectedFile, setSelectedFile] = useState<number | null>(null);
  const [numPages, setNumPages] = useState<number>();
  const [pageNumber, setPageNumber] = useState<number>(1);

  const onDocumentLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      setNumPages(numPages);
    },
    [setNumPages]
  );

  const handleSubmit = async ({ customer, files }: FormValues) => {
    await createArchiveAndDownload(async () => {
      const payload: CreateArchiveInput = {
        customer,
        documents: [],
        files: [],
      };

      files.forEach(({ file, suffix, selectedPages }) => {
        const id = Math.random().toString(36).replace("0.", "doc_");
        const fileId = Math.random().toString(36).replace("0.", "file_");

        payload.documents.push({ id, file });
        payload.files.push({
          id: fileId,
          suffix,
          documents: [{ id, selectedPages }],
        });
      });

      return payload;
    });
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
        } else {
          console.warn(reply?.choices[0].message.content);
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
            <LLMPicker />
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
            <Dropzone onDrop={handleFilesDrop} accept={["application/pdf"]} />
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
