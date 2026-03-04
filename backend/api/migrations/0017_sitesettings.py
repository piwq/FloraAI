from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0016_messageannotation_is_baked'),
    ]

    operations = [
        migrations.CreateModel(
            name='SiteSettings',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('require_subscription', models.BooleanField(default=True, help_text='Выкл → все пользователи получают Premium-доступ без ограничений', verbose_name='Требовать подписку')),
            ],
            options={
                'verbose_name': 'Настройки сайта',
                'verbose_name_plural': 'Настройки сайта',
            },
        ),
    ]
