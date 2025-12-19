/*
  # Add AI Confidence Score Column

  1. Changes
    - Add `ai_confidence_score` column to `complaints` table
      - Type: integer (0-100 representing percentage)
      - Default: 0
      - Not null
  
  2. Notes
    - This column stores the AI's confidence level in its analysis
    - Used to display confidence metrics to users and admins
    - Helps track AI model performance over time
*/

-- Add ai_confidence_score column to complaints table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'complaints' AND column_name = 'ai_confidence_score'
  ) THEN
    ALTER TABLE complaints ADD COLUMN ai_confidence_score integer DEFAULT 0 NOT NULL;
  END IF;
END $$;