
#[cfg(test)]
mod tests {
    use super::*;
    use tokio;

    const SAMPLE: &str = "https://arxiv.org/pdf/2401.12345.pdf";

    #[tokio::test]
    async fn extracts_text_from_pdf() {
        let text = download_and_extract(SAMPLE.into())
            .await
            .expect("should download & parse");
        assert!(text.contains("Abstract"), "extracted text looks wrong");
        println!("{}", text);
    }
}