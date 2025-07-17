-- Migration to populate task_assignments table with existing task data
-- This ensures that all existing tasks have assignment tracking

INSERT INTO task_assignments (task_id, assigned_to, assigned_by, assigned_at, is_current)
SELECT 
    t.id as task_id,
    t.assigned_to,
    COALESCE(t.created_by, t.assigned_to) as assigned_by,  -- Use task creator as assigner, fallback to assigned_to
    t.created_at as assigned_at,
    true as is_current
FROM tasks t
WHERE t.assigned_to IS NOT NULL  -- Only for tasks that are actually assigned
AND NOT EXISTS (
    SELECT 1 FROM task_assignments ta 
    WHERE ta.task_id = t.id 
    AND ta.assigned_to = t.assigned_to 
    AND ta.is_current = true
);

-- Update assignment records for tasks where the creator and assignee are the same
-- In this case, we'll set the assigned_by to the creator (self-assignment)
UPDATE task_assignments 
SET assigned_by = (
    SELECT created_by 
    FROM tasks 
    WHERE id = task_assignments.task_id
)
WHERE assigned_by = assigned_to;