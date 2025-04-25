package main

import (
	"archive/zip"
	"bytes"
	"encoding/base64"
	"fmt"
	"io"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"syscall/js"

	promise "github.com/nlepage/go-js-promise"
	pdfcpu "github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/model"
)

type Customer struct{ js.Value }

func (customer Customer) GetFirstName() string {
	return customer.Get("firstName").String()
}

func (customer Customer) GetLastName() string {
	return customer.Get("lastName").String()
}

type Document struct {
	js.Value
	bytes []byte
}

func (document Document) GetID() string {
	return document.Get("id").String()
}

func (document Document) GetName() string {
	return document.Get("file").Get("name").String()
}

func (document *Document) GetBytes() ([]byte, error) {
	if len(document.bytes) > 0 {
		return document.bytes, nil
	}

	bytea, err := promise.Await(document.Get("file").Call("arrayBuffer"))

	if err != nil {
		return nil, err
	}

	uint8Array := js.Global().Get("Uint8Array").New(bytea)

	document.bytes = make([]byte, uint8Array.Length())

	js.CopyBytesToGo(document.bytes, uint8Array)

	return document.bytes, nil
}

type CustomerFile struct{ js.Value }

func (file CustomerFile) GetID() string {
	return file.Get("id").String()
}

func (file CustomerFile) GetDocuments() []CustomerDocument {
	ds := file.Get("documents")

	cds := make([]CustomerDocument, ds.Length())

	for i := range ds.Length() {
		cds[i] = CustomerDocument{ds.Index(i)}
	}

	return cds
}

func (file CustomerFile) GetSuffix() string {
	return file.Get("suffix").String()
}

type CustomerDocument struct{ js.Value }

func (document CustomerDocument) GetID() string {
	return document.Get("id").String()
}

func (document CustomerDocument) GetSelectedPages() (sps []string) {
	sp := document.Get("selectedPages")

	for i := range sp.Length() {
		sps = append(sps, sp.Index(i).String())
	}

	return
}

type CreateArchiveInput struct{ js.Value }

func (input CreateArchiveInput) GetCustomer() Customer {
	return Customer{input.Get("customer")}
}

func (input CreateArchiveInput) GetDocuments() []Document {
	ds := input.Get("documents")

	documents := make([]Document, ds.Length())

	for i := range ds.Length() {
		documents[i] = Document{ds.Index(i), nil}
	}

	return documents
}

func (input CreateArchiveInput) GetFiles() []CustomerFile {
	fs := input.Get("files")

	cfs := make([]CustomerFile, fs.Length())

	for i := range fs.Length() {
		cfs[i] = CustomerFile{fs.Index(i)}
	}

	return cfs
}

func createArchive(this js.Value, args []js.Value) any {
	input := CreateArchiveInput{args[0]}

	p, res, rej := promise.New()

	go func() {
		buf := new(bytes.Buffer)

		w := zip.NewWriter(buf)

		now := time.Now()

		filePrefix := fmt.Sprintf("%s_%s_%s", now.Format("2006-01-02_15-04-05"), input.GetCustomer().GetLastName(), input.GetCustomer().GetFirstName())

		var fileNames []string

		for _, file := range input.GetFiles() {
			if len(file.GetDocuments()) == 0 {
				rej("At least one document must be provided")

				return
			}

			var document *Document

			for _, doc := range input.GetDocuments() {
				if doc.GetID() == file.GetDocuments()[0].GetID() {
					document = &doc

					break
				}
			}

			if document == nil {
				rej("Couldn't find doc by ID: " + file.GetDocuments()[0].GetID())

				return
			}

			ext := strings.ToLower(filepath.Ext(document.GetName()))

			fileName := fmt.Sprintf("%s_%s%s", filePrefix, file.GetSuffix(), ext)
			i := 1

			for slices.Index(fileNames, fileName) != -1 {
				fileName = fmt.Sprintf("%s_%s-%d%s", filePrefix, file.GetSuffix(), i, ext)
				i++
			}

			fileNames = append(fileNames, fileName)

			f, err := w.Create(fileName)

			if err != nil {
				rej("Couldn't create file: " + err.Error())

				return
			}

			b, err := document.GetBytes()

			if err != nil {
				rej("Couldn't get bytes:" + err.Error())

				return
			}

			if ext != ".pdf" {
				_, err = f.Write(b)

				if err != nil {
					rej("Couldn't write file:" + err.Error())

					return
				}

				continue
			}

			if len(file.GetDocuments()) == 1 {
				if len(file.GetDocuments()[0].GetSelectedPages()) > 0 {
					rs := bytes.NewReader(b)

					err = pdfcpu.Trim(rs, f, file.GetDocuments()[0].GetSelectedPages(), nil)

					if err != nil {
						rej("Couldn't trim PDF: " + err.Error())

						return
					}
				} else {
					_, err = f.Write(b)

					if err != nil {
						rej("219 - Couldn't write file:" + err.Error())

						return
					}
				}

				continue
			}

			var rsc []io.ReadSeeker

			for i := range file.GetDocuments() {
				var document *Document

				for _, doc := range input.GetDocuments() {
					if doc.GetID() == file.GetDocuments()[i].GetID() {
						document = &doc

						break
					}
				}

				if document == nil {
					rej("Couldn't find doc by ID: " + file.GetDocuments()[i].GetID())

					return
				}

				if i != 0 {
					b, err = document.GetBytes()

					if err != nil {
						rej("251 - Couldn't get bytes:" + err.Error())

						return
					}
				}

				var (
					rs = bytes.NewReader(b)
				)

				if len(file.GetDocuments()[i].GetSelectedPages()) > 0 {
					var (
						buf []byte
						res = bytes.NewBuffer(buf)
					)

					err = pdfcpu.Trim(rs, res, file.GetDocuments()[i].GetSelectedPages(), nil)

					if err != nil {
						rej("270 - Couldn't trim PDF: " + err.Error())

						return
					}

					rsc = append(rsc, bytes.NewReader(res.Bytes()))
				} else {
					rsc = append(rsc, rs)
				}
			}

			pdfcpu.MergeRaw(rsc, f, false, nil)
		}

		if err := w.Close(); err != nil {
			rej("Couldn't close ZIP:" + err.Error())

			return
		}

		res(base64.StdEncoding.EncodeToString(buf.Bytes()))
	}()

	return p
}

func init() {
	model.ConfigPath = "disable"
}

func main() {
	c := make(chan struct{}, 0)
	js.Global().Set("createArchive", js.FuncOf(createArchive))
	<-c
}
