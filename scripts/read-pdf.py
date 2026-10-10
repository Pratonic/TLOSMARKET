import PyPDF2

pdf_file = open(r'C:\Users\Pratyush\Downloads\TLOS_Evaluation_System.pdf', 'rb')
read_pdf = PyPDF2.PdfReader(pdf_file)
text = ''
for i in range(len(read_pdf.pages)):
    text += read_pdf.pages[i].extract_text()
print(text)
