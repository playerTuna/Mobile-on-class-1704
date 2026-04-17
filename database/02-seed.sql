-- Users
INSERT INTO "users" (id, email, password, name)
VALUES (
        '11111111-1111-1111-1111-111111111111',
        'alice@example.com',
        'hashed_password_1',
        'Alice'
    ),
    (
        '22222222-2222-2222-2222-222222222222',
        'bob@example.com',
        'hashed_password_2',
        'Bob'
    );
-- Tasks for Alice
INSERT INTO tasks (
        id,
        user_id,
        title,
        description,
        status,
        due_date
    )
VALUES (
        'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
        '11111111-1111-1111-1111-111111111111',
        'Learn NestJS',
        'Study basics of NestJS',
        'pending',
        NOW() + INTERVAL '1 day'
    ),
    (
        'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
        '11111111-1111-1111-1111-111111111111',
        'Build API',
        'Create task API',
        'done',
        NOW() - INTERVAL '1 day'
    );
-- Tasks for Bob
INSERT INTO tasks (
        id,
        user_id,
        title,
        description,
        status,
        due_date
    )
VALUES (
        'bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
        '22222222-2222-2222-2222-222222222222',
        'Write report',
        'Finish backend report',
        'pending',
        NOW() + INTERVAL '2 days'
    ),
    (
        'bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
        '22222222-2222-2222-2222-222222222222',
        'Test API',
        'Test endpoints with Postman',
        'done',
        NOW()
    );