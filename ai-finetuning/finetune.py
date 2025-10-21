import argparse
import time
from typing import Optional

from google import genai
from google.genai.types import (
    HttpOptions,
    CreateTuningJobConfig,
    TuningDataset,
    EvaluationConfig,
    OutputConfig,
    GcsDestination,
    Metric
)


def finetune(
    train_dataset_uri: str,
    validation_dataset_uri: str,
    output_uri_prefix: str,
    base_model: str = "gemini-2.5-flash-lite",
    display_name: str = "Finetuned Model",
    api_key: Optional[str] = None,
):
    """
    Finetune a Gemini model with custom datasets.
    
    Args:
        train_dataset_uri: GCS URI for training data (e.g., 'gs://bucket/train.jsonl')
        validation_dataset_uri: GCS URI for validation data (e.g., 'gs://bucket/val.jsonl')
        output_uri_prefix: GCS URI prefix for outputs (e.g., 'gs://bucket/outputs')
        base_model: Base model to finetune (default: 'gemini-2.5-flash-lite')
        display_name: Display name for the tuned model (default: 'Finetuned Model')
        api_key: Google API key (optional, will use default credentials if not provided)
    
    Returns:
        The completed tuning job object
    """
    # Initialize client
    client_kwargs = {"http_options": HttpOptions(api_version="v1beta1")}
    if api_key:
        client_kwargs["api_key"] = api_key
    
    client = genai.Client(**client_kwargs)
    
    # Prepare datasets
    training_dataset = TuningDataset(gcs_uri=train_dataset_uri)
    validation_dataset = TuningDataset(gcs_uri=validation_dataset_uri)
    
    # Configure evaluation
    evaluation_config = EvaluationConfig(
        metrics=[
            Metric(
                name="FLUENCY",
                prompt_template="""Evaluate this {prediction}"""
            )
        ],
        output_config=OutputConfig(
            gcs_destination=GcsDestination(
                output_uri_prefix=output_uri_prefix,
            )
        ),
    )
    
    # Create tuning job
    print(f"Creating tuning job for {base_model}...")
    print(f"Training data: {train_dataset_uri}")
    print(f"Validation data: {validation_dataset_uri}")
    print(f"Output location: {output_uri_prefix}")
    
    tuning_job = client.tunings.tune(
        base_model=base_model,
        training_dataset=training_dataset,
        config=CreateTuningJobConfig(
            tuned_model_display_name=display_name,
            validation_dataset=validation_dataset,
            evaluation_config=evaluation_config,
        ),
    )
    
    print(f"Job created: {tuning_job.name}")
    
    # Monitor job status
    running_states = {"JOB_STATE_PENDING", "JOB_STATE_RUNNING"}
    
    print("\nMonitoring job status...")
    while tuning_job.state in running_states:
        print(f"Status: {tuning_job.state}")
        tuning_job = client.tunings.get(name=tuning_job.name)
        time.sleep(60)
    
    # Display results
    print(f"\nFinal status: {tuning_job.state}")
    print(f"Tuned model: {tuning_job.tuned_model.model}")
    print(f"Endpoint: {tuning_job.tuned_model.endpoint}")
    print(f"Experiment: {tuning_job.experiment}")
    
    if tuning_job.tuned_model.checkpoints:
        print("\nCheckpoints:")
        for i, checkpoint in enumerate(tuning_job.tuned_model.checkpoints):
            print(f"  Checkpoint {i + 1}: {checkpoint}")
    
    return tuning_job


def parse_args():
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Finetune a Gemini model with custom datasets",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic usage
  python finetune.py \\
    --train gs://bucket/train.jsonl \\
    --validation gs://bucket/val.jsonl \\
    --output gs://bucket/outputs

  # With custom model and name
  python finetune.py \\
    --train gs://bucket/train.jsonl \\
    --validation gs://bucket/val.jsonl \\
    --output gs://bucket/outputs \\
    --model gemini-2.5-flash \\
    --name "My Custom Model"
        """
    )
    
    parser.add_argument(
        "--train",
        type=str,
        required=True,
        help="GCS URI for training dataset (e.g., gs://bucket/train.jsonl)"
    )
    
    parser.add_argument(
        "--validation",
        type=str,
        required=True,
        help="GCS URI for validation dataset (e.g., gs://bucket/val.jsonl)"
    )
    
    parser.add_argument(
        "--output",
        type=str,
        required=True,
        help="GCS URI prefix for outputs (e.g., gs://bucket/outputs)"
    )
    
    parser.add_argument(
        "--model",
        type=str,
        default="gemini-2.5-flash-lite",
        help="Base model to finetune (default: gemini-2.5-flash-lite)"
    )
    
    parser.add_argument(
        "--name",
        type=str,
        default="Finetuned Model",
        help="Display name for the tuned model (default: Finetuned Model)"
    )
    
    parser.add_argument(
        "--api-key",
        type=str,
        default=None,
        help="Google API key (optional, uses default credentials if not provided)"
    )
    
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    
    tuning_job = finetune(
        train_dataset_uri=args.train,
        validation_dataset_uri=args.validation,
        output_uri_prefix=args.output,
        base_model=args.model,
        display_name=args.name,
        api_key=args.api_key,
    )