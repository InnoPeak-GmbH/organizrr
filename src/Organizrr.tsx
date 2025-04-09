import {
  ActionIcon,
  AppShell,
  Autocomplete,
  Box,
  Burger,
  Button,
  Group,
  Loader,
  MantineSize,
  Pagination,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { Document, Page } from "react-pdf";
import {
  IconDownload,
  IconEye,
  IconEyeOff,
  IconFilePlus,
  IconFiles,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconRestore,
  IconTrash,
} from "@tabler/icons-react";
import {
  createArchiveAndDownload,
  fileCategories,
  getFileDataUrl,
  systemMessage,
} from "./utils";
import { isNotEmpty, useForm } from "@mantine/form";
import { useCallback, useMemo, useState } from "react";

import { ChatCompletionMessageParam } from "@mlc-ai/web-llm";
import Dropzone from "./Dropzone";
import { FileWithPath } from "@mantine/dropzone";
import LLMPicker from "./LLMPicker";
import classNames from "./Organizrr.module.css";
import { useDisclosure } from "@mantine/hooks";
import { useMLEngine } from "./MLEngineContext";

type FormValues = {
  customer: { firstName: string; lastName: string };
  documents: { file: FileWithPath; id: string }[];
  files: {
    id: string;
    documents: { id: string; selectedPages?: string }[];
    suffix: string;
  }[];
};

function Organizrr() {
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] =
    useDisclosure(true);
  const [desktopOpened, { close: closeDesktop, open: openDesktop }] =
    useDisclosure(true);

  const previewBreakpoint: MantineSize = "xl";
  const [previewMobileOpened, { toggle: togglePreviewMobile }] =
    useDisclosure();
  const [previewOpened, { toggle: togglePreview, open: openPreview }] =
    useDisclosure(true);

  const { engine } = useMLEngine();

  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);

  const [activeFile, setActiveFile] = useState<number | null>(null);
  const [generatingFilenames, setGeneratingFilenames] = useState<string[]>([]);

  const form = useForm<FormValues>({
    mode: "controlled",
    initialValues: {
      customer: { firstName: "", lastName: "" },
      documents: [],
      files: [],
    },
    validate: {
      customer: {
        firstName: isNotEmpty("First name must be given"),
        lastName: isNotEmpty("Last name must be given"),
      },
      files: {
        suffix: isNotEmpty("Suffix must be given"),
        documents: {
          id: isNotEmpty("Document must be selected"),
          selectedPages: (val) => {
            if (
              val
                ?.split(",")
                .some(
                  (val) =>
                    !/^\d+$/.test(val.replaceAll(" ", "")) &&
                    !/^\d+\-\d+$/.test(val.replaceAll(" ", "")) &&
                    val.replaceAll(" ", "") !== "odd" &&
                    val.replaceAll(" ", "") !== "even"
                )
            ) {
              return "Page numbers must be given as a comma separated list";
            }
          },
        },
      },
    },
    validateInputOnBlur: true,
  });

  const activeDocument = useMemo(
    () =>
      activeDocumentId &&
      form.values.documents.find((d) => d.id === activeDocumentId),
    [activeDocumentId, form]
  );

  const [numPages, setNumPages] = useState<number>();
  const [pageNumber, setPageNumber] = useState<number>(1);

  const onDocumentLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      setNumPages(numPages);
    },
    [setNumPages]
  );

  const handleFileDrop = (files: FileWithPath[]) => {
    if (files.length < 1) return;

    files.forEach((f) => {
      const id = Math.random().toString(36).replace("0.", "doc_");
      const fileId = Math.random().toString(36).replace("0.", "file_");

      form.insertListItem("documents", { id, file: f });
      form.insertListItem("files", {
        id: fileId,
        documents: [{ id }],
        suffix: "",
      });

      if (engine.current) {
        const messages: ChatCompletionMessageParam[] = [
          systemMessage,
          { role: "user", content: "The file name is: " + f.name },
        ];

        setGeneratingFilenames((fns) => [...fns, fileId]);

        engine.current.chat.completions
          .create({
            messages,
          })
          .then((reply) => {
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
                if (f.id === fileId) {
                  form.setFieldValue(
                    `files.${idx}.suffix`,
                    reply?.choices[0].message.content?.split("\n")[0]
                  );
                }
              });
            } else {
              console.warn(reply?.choices[0].message.content);
            }

            setGeneratingFilenames((fns) => fns.filter((fn) => fn !== fileId));
          })
          .catch((e) => {
            console.error(e);

            setGeneratingFilenames((fns) => fns.filter((fn) => fn !== fileId));
          });
      }
    });

    setActiveFile(form.getValues().files.length - 1);
    setActiveDocumentId(
      form.getValues().documents[form.getValues().documents.length - 1].id
    );
  };

  const handleDocumentDrop = (files: FileWithPath[]) => {
    if (activeFile === null) return;

    files.forEach((f) => {
      const id = Math.random().toString(36).replace("0.", "doc_");

      form.insertListItem("documents", { id, file: f });
      form.insertListItem(`files.${activeFile}.documents`, { id });
    });

    setActiveDocumentId(
      form.getValues().documents[form.getValues().documents.length - 1].id
    );
  };

  const handleDocumentSelect = (id: string | null) => {
    if (id === null) return;
    if (activeFile === null) return;

    form.insertListItem(`files.${activeFile}.documents`, { id });

    setActiveDocumentId(id);
  };

  const handleSubmit = async ({ customer, files, documents }: FormValues) => {
    await createArchiveAndDownload(async () => {
      return {
        customer,
        files: files.map((f) => ({
          ...f,
          documents: f.documents.map((d) => {
            const selectedPages = d.selectedPages
              ?.split(",")
              .map((sp) => sp.replaceAll(" ", ""));

            return {
              ...d,
              selectedPages: selectedPages?.length ? selectedPages : [],
            };
          }),
        })),
        documents: await Promise.all(
          documents.map(async (d) => ({
            ...d,
            name: d.file.name,
            blob: await getFileDataUrl(d.file),
          }))
        ),
      };
    });
  };

  const handleErrors = (errors: typeof form.errors) => {
    for (const [key] of Object.entries(errors)) {
      if (key.startsWith("files.")) {
        if (!Number.isNaN(parseInt(key.split(".")[1]))) {
          const idx = parseInt(key.split(".")[1]);
          setActiveFile(idx);
          break;
        }
      }
    }
  };

  return (
    <AppShell
      header={{ height: 100 }}
      footer={{ height: desktopOpened ? 0 : 60 }}
      navbar={{
        width: 300,
        breakpoint: "sm",
        collapsed: { mobile: !mobileOpened, desktop: !desktopOpened },
      }}
      aside={{
        width: 600,
        breakpoint: previewBreakpoint,
        collapsed: { mobile: !previewMobileOpened, desktop: !previewOpened },
      }}
      padding="md"
    >
      <form onSubmit={form.onSubmit(handleSubmit, handleErrors)}>
        <AppShell.Header bg="var(--mantine-primary-color-3)">
          <Group px="md">
            <Burger
              opened={mobileOpened}
              onClick={toggleMobile}
              hiddenFrom="sm"
              size="sm"
            />
            <Stack gap="xs">
              <Title c="white" order={1}>
                Organizrr
              </Title>
              <Text c="var(--mantine-primary-color-8)">By InnoPeak</Text>
            </Stack>
            <Group ml="auto">
              <LLMPicker />

              <ActionIcon
                variant="subtle"
                onClick={togglePreview}
                visibleFrom={previewBreakpoint}
              >
                {previewOpened ? <IconEyeOff /> : <IconEye />}
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                onClick={togglePreviewMobile}
                hiddenFrom={previewBreakpoint}
              >
                {previewMobileOpened ? <IconEyeOff /> : <IconEye />}
              </ActionIcon>
            </Group>
          </Group>
        </AppShell.Header>

        <AppShell.Navbar p="md" bg="var(--mantine-primary-color-0)">
          <AppShell.Section>
            <Group>
              <IconFiles />
              <Title order={3}>Files</Title>
              <ActionIcon
                variant="subtle"
                ml="auto"
                onClick={() => {
                  const id = Math.random().toString(36).replace("0.", "file_");
                  form.insertListItem("files", { id, documents: [] });
                  setActiveFile(form.getValues().files.length - 1);
                }}
              >
                <IconFilePlus />
              </ActionIcon>
            </Group>
          </AppShell.Section>
          <AppShell.Section grow my="md" component={ScrollArea}>
            <Stack>
              {form.values.files.map((f, idx) => (
                <Stack key={f.id} gap="xs">
                  <Group>
                    <Button
                      variant={idx === activeFile ? "" : "subtle"}
                      onClick={() => {
                        setActiveFile(idx);
                        closeMobile();
                      }}
                      rightSection={
                        generatingFilenames.includes(f.id) ? (
                          <Loader size="xs" type="bars" color="white" />
                        ) : null
                      }
                      style={{ flex: 1 }}
                    >
                      <Text>{f.suffix || f.id}</Text>
                    </Button>
                    <ActionIcon
                      onClick={() => {
                        if (activeFile === idx) {
                          setActiveFile(null);
                        }
                        form.removeListItem("files", idx);
                      }}
                      variant="subtle"
                      c="red"
                    >
                      <IconTrash />
                    </ActionIcon>
                  </Group>
                  {activeFile != idx &&
                    form.errors &&
                    Object.entries(form.errors)
                      .filter(([key]) => key.startsWith(`files.${idx}`))
                      .map(([_, error]) => <Text c="red">{error}</Text>)}
                </Stack>
              ))}
            </Stack>
          </AppShell.Section>
          <AppShell.Section>
            <Stack>
              <Dropzone onDrop={handleFileDrop} />
              <Group justify="flex-end">
                <ActionIcon
                  variant="transparent"
                  onClick={closeDesktop}
                  visibleFrom="sm"
                >
                  <IconLayoutSidebarLeftCollapse />
                </ActionIcon>
              </Group>
            </Stack>
          </AppShell.Section>
        </AppShell.Navbar>

        <AppShell.Main pb="md">
          <Stack pb={30}>
            <Group>
              <Title order={2} size="h1">
                Customer
              </Title>
              <Group ml="auto">
                <Tooltip label="Formular zurücksetzen">
                  <ActionIcon
                    variant="subtle"
                    c="red"
                    onClick={() => {
                      form.reset();
                      setActiveFile(null);
                    }}
                  >
                    <IconRestore />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>
            <Group>
              <TextInput
                label="First Name"
                placeholder="First Name"
                withAsterisk
                required
                {...form.getInputProps("customer.firstName")}
                key={form.key("customer.firstName")}
              />
              <TextInput
                label="Last Name"
                placeholder="Last Name"
                withAsterisk
                required
                {...form.getInputProps("customer.lastName")}
                key={form.key("customer.lastName")}
              />
            </Group>
            {activeFile !== null && (
              <Paper p="md" bg="var(--mantine-primary-color-0)">
                <Stack>
                  <Autocomplete
                    label="Category"
                    data={fileCategories}
                    withAsterisk
                    required
                    {...form.getInputProps(`files.${activeFile}.suffix`)}
                    key={form.key(`files.${activeFile}.suffix`)}
                  />
                  <Group>
                    <IconFiles />
                    <Title order={3}>Documents</Title>
                  </Group>
                  <ScrollArea offsetScrollbars>
                    <Group wrap="nowrap" align="start">
                      {form.values.files[activeFile]?.documents.map(
                        (d, idx) => (
                          <Stack
                            key={`${d.id}-${idx}`}
                            w={300}
                            style={{ cursor: "pointer" }}
                            onClick={() => {
                              setActiveDocumentId(d.id);
                              openPreview();
                            }}
                          >
                            <Group>
                              <Text>
                                {
                                  form.values.documents.find(
                                    (_d) => _d.id === d.id
                                  )?.file.name
                                }
                              </Text>
                              <ActionIcon
                                ml="auto"
                                variant="subtle"
                                color="red"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  form.removeListItem(
                                    `files.${activeFile}.documents`,
                                    idx
                                  );
                                }}
                              >
                                <IconTrash />
                              </ActionIcon>
                            </Group>
                            {form.values.documents
                              .find((_d) => _d.id === d.id)
                              ?.file.name.toLowerCase()
                              .endsWith(".pdf") && (
                              <ScrollArea h={400} w="100%">
                                <Document
                                  file={
                                    form.values.documents.find(
                                      (_d) => _d.id === d.id
                                    )?.file
                                  }
                                  className={classNames.pdfThumbnail}
                                >
                                  <Page pageNumber={1} scale={0.5} />
                                </Document>
                              </ScrollArea>
                            )}
                            <TextInput
                              label="Selected pages"
                              placeholder="1, 3-4, even, odd"
                              onClick={(e) => e.stopPropagation()}
                              {...form.getInputProps(
                                `files.${activeFile}.documents.${idx}.selectedPages`
                              )}
                              key={form.key(
                                `files.${activeFile}.documents.${idx}.selectedPages`
                              )}
                            />
                          </Stack>
                        )
                      )}
                      {form.values.files[activeFile].documents.every((doc) =>
                        form.values.documents
                          .find((d) => d.id === doc.id)
                          ?.file.name.toLowerCase()
                          .endsWith(".pdf")
                      ) && (
                        <Stack
                          w={300}
                          key={form.values.files[activeFile]?.documents.length}
                        >
                          <Select
                            label="Add file"
                            data={form.values.documents.map(({ id, file }) => ({
                              value: id,
                              label: file.name,
                            }))}
                            onChange={handleDocumentSelect}
                          />
                          <Dropzone
                            onDrop={handleDocumentDrop}
                            accept={["application/pdf"]}
                          />
                        </Stack>
                      )}
                    </Group>
                  </ScrollArea>
                </Stack>
              </Paper>
            )}
            <Group justify="end">
              <Button leftSection={<IconDownload />} type="submit">
                Download
              </Button>
            </Group>
          </Stack>
        </AppShell.Main>

        <AppShell.Aside p="md" bg="var(--mantine-primary-color-0)">
          <AppShell.Section>
            <Stack>
              <Group style={{ alignSelf: "start" }}>
                <IconEye /> <Title order={3}>Preview</Title>
              </Group>
              <Select
                label="Select file"
                data={form.values.documents.map(({ id, file }) => ({
                  value: id,
                  label: file.name,
                }))}
                value={activeDocumentId}
                onChange={setActiveDocumentId}
              />
            </Stack>
          </AppShell.Section>
          <AppShell.Section grow my="md" component={ScrollArea}>
            <Stack align="center">
              {activeDocument &&
                activeDocument.file.name.toLowerCase().endsWith(".pdf") && (
                  <Document
                    file={activeDocument.file}
                    onLoadSuccess={onDocumentLoadSuccess}
                  >
                    <Page pageNumber={pageNumber} scale={0.8} />
                  </Document>
                )}
            </Stack>
          </AppShell.Section>
          <AppShell.Section>
            {activeDocument && (
              <Stack align="center">
                <Pagination
                  value={pageNumber}
                  onChange={setPageNumber}
                  total={numPages ?? 0}
                />
              </Stack>
            )}
          </AppShell.Section>
        </AppShell.Aside>

        <AppShell.Footer p="md">
          <ActionIcon
            variant="transparent"
            onClick={openDesktop}
            visibleFrom="sm"
          >
            <IconLayoutSidebarLeftExpand />
          </ActionIcon>
        </AppShell.Footer>
      </form>
    </AppShell>
  );
}

export default Organizrr;
