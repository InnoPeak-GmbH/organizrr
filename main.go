package main

import (
	"archive/zip"
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"path/filepath"
	"slices"
	"time"

	"syscall/js"

	pdfcpu "github.com/pdfcpu/pdfcpu/pkg/api"
)

type Customer struct {
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
}

type CustomerFile struct {
	Name          string   `json:"name"`
	Blob          string   `json:"blob"`
	SelectedPages []string `json:"selectedPages"`
	Suffix        string   `json:"suffix"`
}

type CreateArchiveInput struct {
	Customer Customer       `json:"customer"`
	Files    []CustomerFile `json:"files"`
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
			ext := filepath.Ext(file.Name)

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

			b, err := base64.StdEncoding.DecodeString(file.Blob)

			if err != nil {
				reject.Invoke(err.Error())

				return nil
			}

			if ext == ".pdf" && len(file.SelectedPages) > 0 {
				rs := bytes.NewReader(b)

				err = pdfcpu.Trim(rs, f, file.SelectedPages, nil)

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

func main() {
	c := make(chan struct{}, 0)
	js.Global().Set("createArchive", js.FuncOf(createArchive))
	<-c
}
