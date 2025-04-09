package main

import (
	"archive/zip"
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"syscall/js"

	pdfcpu "github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/model"
)

type Customer struct {
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
}

type Document struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Blob string `json:"blob"`
}

type CustomerFile struct {
	ID        string             `json:"id"`
	Documents []CustomerDocument `json:"documents"`
	Suffix    string             `json:"suffix"`
}

type CustomerDocument struct {
	ID            string   `json:"id"`
	SelectedPages []string `json:"selectedPages"`
}

type CreateArchiveInput struct {
	Customer  Customer       `json:"customer"`
	Documents []Document     `json:"documents"`
	Files     []CustomerFile `json:"files"`
}

type CreateArchiveResult struct {
	ResultArchive *string `json:"resultArchive"`
	Error         *string `json:"error"`
}

func createArchive(this js.Value, args []js.Value) any {
	var input CreateArchiveInput

	err := json.Unmarshal([]byte(args[0].String()), &input)

	handler := js.FuncOf(func(this js.Value, args []js.Value) any {
		var (
			resolve = args[0]
			reject  = args[1]
		)

		if err != nil {
			reject.Invoke(err.Error())

			return nil
		}

		buf := new(bytes.Buffer)

		w := zip.NewWriter(buf)

		now := time.Now()

		filePrefix := fmt.Sprintf("%s_%s_%s", now.Format("2006-01-02_15-04-05"), input.Customer.LastName, input.Customer.FirstName)

		var fileNames []string

		for _, file := range input.Files {
			if len(file.Documents) == 0 {
				reject.Invoke("At least one document must be provided")

				return nil
			}

			var document *Document

			for _, doc := range input.Documents {
				if doc.ID == file.Documents[0].ID {
					document = &doc

					break
				}
			}

			if document == nil {
				reject.Invoke("Couldn't find doc by ID: " + file.Documents[0].ID)

				return nil
			}

			ext := strings.ToLower(filepath.Ext(document.Name))

			fileName := fmt.Sprintf("%s_%s%s", filePrefix, file.Suffix, ext)
			i := 1

			for slices.Index(fileNames, fileName) != -1 {
				fileName = fmt.Sprintf("%s_%s-%d%s", filePrefix, file.Suffix, i, ext)
				i++
			}

			fileNames = append(fileNames, fileName)

			f, err := w.Create(fileName)

			if err != nil {
				reject.Invoke(err.Error())

				return nil
			}

			b, err := base64.StdEncoding.DecodeString(document.Blob)

			if err != nil {
				reject.Invoke(err.Error())

				return nil
			}

			if ext != ".pdf" {
				_, err = f.Write(b)

				if err != nil {
					reject.Invoke(err.Error())

					return nil
				}

				continue
			}

			if len(file.Documents) == 1 {
				if len(file.Documents[0].SelectedPages) > 0 {
					rs := bytes.NewReader(b)

					err = pdfcpu.Trim(rs, f, file.Documents[0].SelectedPages, nil)

					if err != nil {
						reject.Invoke(err.Error())

						return nil
					}
				} else {
					_, err = f.Write(b)

					if err != nil {
						reject.Invoke(err.Error())

						return nil
					}
				}

				continue
			}

			var rsc []io.ReadSeeker

			for i := range file.Documents {
				var document *Document

				for _, doc := range input.Documents {
					if doc.ID == file.Documents[i].ID {
						document = &doc

						break
					}
				}

				if document == nil {
					reject.Invoke("Couldn't find doc by ID: " + file.Documents[i].ID)

					return nil
				}

				if i != 0 {
					b, err = base64.StdEncoding.DecodeString(document.Blob)

					if err != nil {
						reject.Invoke(err.Error())

						return nil
					}
				}

				var (
					rs = bytes.NewReader(b)
				)

				if len(file.Documents[i].SelectedPages) > 0 {
					var (
						buf []byte
						res = bytes.NewBuffer(buf)
					)

					err = pdfcpu.Trim(rs, res, file.Documents[i].SelectedPages, nil)

					if err != nil {
						reject.Invoke(err.Error())

						return nil
					}

					rsc = append(rsc, bytes.NewReader(res.Bytes()))
				} else {
					rsc = append(rsc, rs)
				}
			}

			pdfcpu.MergeRaw(rsc, f, false, nil)
		}

		if err = w.Close(); err != nil {
			reject.Invoke(err.Error())

			return nil
		}

		resolve.Invoke(base64.StdEncoding.EncodeToString(buf.Bytes()))

		return nil
	})

	promiseConstructor := js.Global().Get("Promise")
	return promiseConstructor.New(handler)
}

func init() {
	model.ConfigPath = "disable"
}

func main() {
	c := make(chan struct{}, 0)
	js.Global().Set("createArchive", js.FuncOf(createArchive))
	<-c
}
