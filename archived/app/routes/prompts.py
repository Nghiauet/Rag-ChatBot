from fastapi import APIRouter, HTTPException
import yaml
import logging

from app.models import PromptConfig, PromptUpdateRequest
from app.config import PROMPTS_FILE

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/prompts", tags=["prompts"])


@router.get("", response_model=PromptConfig)
async def get_prompts():
    logger.info("Getting prompt configuration...")
    try:
        with open(PROMPTS_FILE, "r") as file:
            prompts = yaml.safe_load(file)
        logger.info("Prompt configuration loaded successfully")
        return PromptConfig(**prompts)
    except FileNotFoundError:
        logger.error("Prompts configuration file not found")
        raise HTTPException(status_code=404, detail="Prompts configuration file not found")
    except Exception as e:
        logger.error(f"Error reading prompts: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error reading prompts: {str(e)}")


@router.put("")
async def update_prompts(request: PromptUpdateRequest):
    logger.info("Updating prompt configuration...")
    try:
        prompts_dict = request.prompts.model_dump()
        with open(PROMPTS_FILE, "w") as file:
            yaml.dump(prompts_dict, file, default_flow_style=False, allow_unicode=True)
        logger.info("Prompt configuration updated successfully")
        return {"message": "Prompts updated successfully"}
    except Exception as e:
        logger.error(f"Error updating prompts: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error updating prompts: {str(e)}")